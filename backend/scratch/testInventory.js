const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING INVENTORY MANAGEMENT TESTING ---');

  // 1. Setup/Fetch Test Student
  let student = await prisma.student.findFirst();
  if (!student) {
    console.log('Creating a test student...');
    student = await prisma.student.create({
      data: {
        name: 'Test Student',
        email: `test_student_${Date.now()}@example.com`,
        roll_no: `ROLL_${Date.now()}`,
        password_hash: 'mock_password_hash',
        is_verified: true,
      },
    });
  }
  console.log(`Using Student ID: ${student.id} (${student.name})`);

  // 2. Setup Test Menu Item
  console.log('Creating test menu item "Test Samosa"...');
  const testMenuItem = await prisma.menuItem.create({
    data: {
      name: `Test Samosa ${Date.now()}`,
      meal_type: 'snacks',
      price: 20.00,
      is_active: true,
      description: 'Golden crispy test pastry',
    },
  });
  console.log(`Created MenuItem ID: ${testMenuItem.id} - name: ${testMenuItem.name}`);

  // 3. Setup Test Inventory Item
  console.log('Creating test inventory item "Test Potato"...');
  // Generate code atomically using our upsert logic
  const counter = await prisma.inventoryCounter.upsert({
    where: { id: 1 },
    update: { last_value: { increment: 1 } },
    create: { id: 1, last_value: 1 },
  });
  const uniqueId = `INV-${String(counter.last_value).padStart(4, '0')}`;

  const testInventoryItem = await prisma.inventoryItem.create({
    data: {
      unique_inventory_id: uniqueId,
      name: 'Test Potato',
      unit: 'kg',
      quantity_in_stock: 10.000, // 10 kg
      low_stock_threshold: 2.000, // 2 kg
      is_active: true,
    },
  });
  console.log(`Created InventoryItem ID: ${testInventoryItem.id} code: ${testInventoryItem.unique_inventory_id}`);

  // Log initial restock
  await prisma.inventoryLog.create({
    data: {
      inventory_item_id: testInventoryItem.id,
      action_type: 'restock',
      quantity_changed: 10.000,
    },
  });

  const convertToInventoryBaseUnit = (quantity, recipeUnit, inventoryUnit) => {
    const q = Number(quantity);
    const rUnit = String(recipeUnit).toLowerCase();
    const iUnit = String(inventoryUnit).toLowerCase();
    if (rUnit === iUnit) return q;
    if (rUnit === 'g' && iUnit === 'kg') return q / 1000;
    if (rUnit === 'kg' && iUnit === 'g') return q * 1000;
    if (rUnit === 'ml' && iUnit === 'litre') return q / 1000;
    if (rUnit === 'litre' && iUnit === 'ml') return q * 1000;
    return q;
  };

  // 4. Create Recipe mapping: "Test Samosa" requires 50 g of "Test Potato" (stored as 50.000, quantity_unit: g)
  console.log('Linking Test Samosa to Test Potato (RecipeItem: 50 g)...');
  const recipeItem = await prisma.recipeItem.create({
    data: {
      menu_item_id: testMenuItem.id,
      inventory_item_id: testInventoryItem.id,
      quantity_required: 50.000,
      quantity_unit: 'g',
    },
  });
  console.log(`Created RecipeItem ID: ${recipeItem.id}`);

  // 5. Test Live Menu fetching logic (is_in_stock computation)
  console.log('Verifying is_in_stock field during menu fetch...');
  const menuItems = await prisma.menuItem.findMany({
    where: { id: testMenuItem.id },
    include: {
      recipe_items: {
        include: {
          inventory_item: true,
        },
      },
    },
  });

  const mapMenuItem = (record) => {
    let isInStock = true;
    if (record.recipe_items && record.recipe_items.length > 0) {
      isInStock = record.recipe_items.every((ri) => {
        if (!ri.inventory_item || !ri.inventory_item.is_active) return false;
        const neededInBase = convertToInventoryBaseUnit(
          ri.quantity_required,
          ri.quantity_unit || ri.inventory_item.unit,
          ri.inventory_item.unit
        );
        return Number(ri.inventory_item.quantity_in_stock) >= neededInBase;
      });
    }
    return {
      ...record,
      is_in_stock: isInStock,
    };
  };

  const fetchedItem = mapMenuItem(menuItems[0]);
  console.log(`Calculated is_in_stock for Samosa: ${fetchedItem.is_in_stock} (Expected: true)`);
  if (!fetchedItem.is_in_stock) {
    throw new Error('Menu item should be in stock but is calculated as out of stock.');
  }

  // 6. Place a test order for 5 Samosas and check transaction & stock deduction
  console.log('Simulating order creation for 5 Samosas...');
  const validatedItems = [
    {
      menu_item_id: testMenuItem.id,
      item_name: testMenuItem.name,
      price: Number(testMenuItem.price),
      quantity: 5,
    },
  ];

  const todayDate = new Date().toISOString().split('T')[0];

  // Run the transaction block mimicking orderController
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        student_id: student.id,
        meal_type: 'snacks',
        total_amount: Number(testMenuItem.price) * 5,
        payment_status: 'pending',
        order_status: 'placed',
        date: todayDate,
      },
    });

    await tx.orderItem.createMany({
      data: validatedItems.map((item) => ({
        order_id: newOrder.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        price: item.price,
        quantity: item.quantity,
      })),
    });

    // Deduction logic
    const deductions = {};
    for (const item of validatedItems) {
      const recipes = await tx.recipeItem.findMany({
        where: { menu_item_id: item.menu_item_id },
        include: { inventory_item: true },
      });
      for (const ri of recipes) {
        const convertedRequired = convertToInventoryBaseUnit(
          ri.quantity_required,
          ri.quantity_unit || ri.inventory_item.unit,
          ri.inventory_item.unit
        );
        const needed = convertedRequired * item.quantity;
        const itemId = ri.inventory_item_id;
        if (!deductions[itemId]) {
          deductions[itemId] = { needed: 0, name: ri.inventory_item.name };
        }
        deductions[itemId].needed += needed;
      }
    }

    const sortedIds = Object.keys(deductions).map(Number).sort((a, b) => a - b);
    for (const itemId of sortedIds) {
      const { needed, name } = deductions[itemId];

      // SELECT FOR UPDATE
      const [invItem] = await tx.$queryRaw`
        SELECT id, name, quantity_in_stock, is_active FROM InventoryItem WHERE id = ${itemId} FOR UPDATE
      `;

      if (!invItem || !invItem.is_active || Number(invItem.quantity_in_stock) < needed) {
        throw new Error(`Sorry, ${name} is temporarily unavailable due to low stock`);
      }

      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { quantity_in_stock: Number(invItem.quantity_in_stock) - needed },
      });

      await tx.inventoryLog.create({
        data: {
          inventory_item_id: itemId,
          action_type: 'deduction',
          quantity_changed: -needed,
          order_id: newOrder.id,
        },
      });
    }

    return newOrder;
  }, {
    timeout: 30000
  });

  console.log(`Order created successfully! ID: ${order.id}`);

  // Verify stock updated: 10 - (0.05 * 5) = 9.750 kg
  const checkStock1 = await prisma.inventoryItem.findUnique({
    where: { id: testInventoryItem.id },
  });
  console.log(`Updated stock of Test Potato: ${checkStock1.quantity_in_stock} kg (Expected: 9.750)`);
  if (Number(checkStock1.quantity_in_stock) !== 9.750) {
    throw new Error(`Stock level is incorrect. Found ${checkStock1.quantity_in_stock}, expected 9.750`);
  }

  // Verify log was written
  const logs = await prisma.inventoryLog.findMany({
    where: { order_id: order.id },
  });
  console.log(`Logs created for order: ${logs.length} (Expected: 1)`);
  console.log(`Log details: change = ${logs[0].quantity_changed} (Expected: -0.250)`);
  if (Number(logs[0].quantity_changed) !== -0.250) {
    throw new Error('Log quantity change is incorrect.');
  }

  // 7. Test Depletion and unorderable MenuItem
  console.log('Depleting stock of Test Potato to 0.010 kg (below 0.050 kg requirement)...');
  await prisma.inventoryItem.update({
    where: { id: testInventoryItem.id },
    data: { quantity_in_stock: 0.010 },
  });

  const checkStock2 = await prisma.menuItem.findMany({
    where: { id: testMenuItem.id },
    include: {
      recipe_items: {
        include: {
          inventory_item: true,
        },
      },
    },
  });
  const depletedItem = mapMenuItem(checkStock2[0]);
  console.log(`Samosa is_in_stock after depletion: ${depletedItem.is_in_stock} (Expected: false)`);
  if (depletedItem.is_in_stock) {
    throw new Error('Menu item should show as out of stock (is_in_stock: false)');
  }

  // 8. Test transaction rollback on ordering exceeding available stock
  console.log('Simulating placing an order exceeding available stock (ordering 1 samosa requiring 0.050, but stock is 0.010)...');
  let orderErrorThrown = false;
  try {
    await prisma.$transaction(async (tx) => {
      const badOrder = await tx.order.create({
        data: {
          student_id: student.id,
          meal_type: 'snacks',
          total_amount: Number(testMenuItem.price),
          payment_status: 'pending',
          order_status: 'placed',
          date: todayDate,
        },
      });

      await tx.orderItem.createMany({
        data: [
          {
            order_id: badOrder.id,
            menu_item_id: testMenuItem.id,
            item_name: testMenuItem.name,
            price: Number(testMenuItem.price),
            quantity: 1,
          },
        ],
      });

      // Deduction logic
      const [invItem] = await tx.$queryRaw`
        SELECT id, name, quantity_in_stock, is_active FROM InventoryItem WHERE id = ${testInventoryItem.id} FOR UPDATE
      `;

      const needed = 0.050; // 1 Samosa
      if (Number(invItem.quantity_in_stock) < needed) {
        throw new Error(`Sorry, ${invItem.name} is temporarily unavailable due to low stock`);
      }

      await tx.inventoryItem.update({
        where: { id: testInventoryItem.id },
        data: { quantity_in_stock: Number(invItem.quantity_in_stock) - needed },
      });
    }, {
      timeout: 30000
    });
  } catch (err) {
    orderErrorThrown = true;
    console.log(`Successfully intercepted transaction rejection: "${err.message}"`);
  }

  if (!orderErrorThrown) {
    throw new Error('Order transaction did not fail when stock was insufficient.');
  }

  // Verify stock remained unchanged (0.010)
  const finalStock = await prisma.inventoryItem.findUnique({
    where: { id: testInventoryItem.id },
  });
  console.log(`Stock after rolled back transaction: ${finalStock.quantity_in_stock} kg (Expected: 0.010)`);
  if (Number(finalStock.quantity_in_stock) !== 0.010) {
    throw new Error(`Rollback failed! Stock was decremented to ${finalStock.quantity_in_stock}`);
  }

  // 9. Clean up test records
  console.log('Cleaning up test database records...');
  await prisma.inventoryLog.deleteMany({
    where: { inventory_item_id: testInventoryItem.id },
  });
  await prisma.recipeItem.deleteMany({
    where: { menu_item_id: testMenuItem.id },
  });
  await prisma.orderItem.deleteMany({
    where: { order_id: order.id },
  });
  await prisma.order.delete({
    where: { id: order.id },
  });
  await prisma.inventoryItem.delete({
    where: { id: testInventoryItem.id },
  });
  await prisma.menuItem.delete({
    where: { id: testMenuItem.id },
  });

  console.log('--- ALL INVENTORY MANAGEMENT TESTS PASSED SUCCESSFULLY! ---');
}

runTests()
  .catch((err) => {
    console.error('Test script failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
