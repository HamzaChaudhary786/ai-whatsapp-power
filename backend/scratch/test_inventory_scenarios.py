import asyncio
from bson import ObjectId
from db.mongodb import get_database, connect_to_mongo
from models.order_model import OrderCreate, OrderItem, AddressSnapshot, OrderStatus, OrderUpdateStatus
from controllers.order_controller import OrderController

async def run_tests():
    print("=== STARTING INVENTORY & STOCK LIFECYCLE TESTS ===")
    await connect_to_mongo()
    db = get_database()

    # Find a test variant
    variant = await db["product_variants"].find_one({"available_quantity": {"$gt": 10}})
    assert variant, "No variant found with available_quantity > 10"
    v_id = str(variant["_id"])
    p_id = str(variant["product_id"])
    initial_qty = int(variant["available_quantity"])
    color = variant.get("color")
    size = variant.get("size")
    sku = variant.get("sku")
    print(f"[SETUP] Selected Variant: {v_id} ({color} / {size}) | Initial Available Stock: {initial_qty}")

    # TEST 1: Stock Decrement on Order Creation (e.g. from 14 to 12)
    order_qty = 2
    order_in = OrderCreate(
        customer_id="guest",
        items=[
            OrderItem(
                product_id=p_id,
                variant_id=v_id,
                name="Automated Inventory Test Dress",
                sku=sku,
                unit_price=1000.0,
                quantity=order_qty,
                total_price=2000.0,
                color=color,
                size=size,
            )
        ],
        subtotal=2000.0,
        delivery_fee=0.0,
        total=2000.0,
        currency="PKR",
        address_snapshot=AddressSnapshot(
            full_name="Sara Test Shopper",
            phone="+923001234567",
            street_address="House 1, Test Street",
            city="Lahore",
        ),
        status=OrderStatus.PENDING,
    )

    created = await OrderController.create_order(order_in)
    order_id = created["id"]
    order_number = created["order_number"]
    print(f"[TEST 1 PASS] Created Order #{order_number} for {order_qty} units.")

    # Check stock in DB
    v_after_order = await db["product_variants"].find_one({"_id": ObjectId(v_id)})
    expected_qty_after_order = initial_qty - order_qty
    actual_qty_after_order = int(v_after_order["available_quantity"])
    print(f"   Stock after ordering: {actual_qty_after_order} (Expected: {expected_qty_after_order})")
    assert actual_qty_after_order == expected_qty_after_order, f"Stock mismatch! Got {actual_qty_after_order}, expected {expected_qty_after_order}"

    # TEST 2: Stock Replenishment on Order Cancellation
    print("\n--- Testing Order Cancellation Restock ---")
    await OrderController.update_status(
        order_id=order_id,
        update_in=OrderUpdateStatus(status=OrderStatus.CANCELLED, note="Customer cancelled"),
    )
    v_after_cancel = await db["product_variants"].find_one({"_id": ObjectId(v_id)})
    actual_qty_after_cancel = int(v_after_cancel["available_quantity"])
    print(f"   Stock after cancellation: {actual_qty_after_cancel} (Expected: {initial_qty})")
    assert actual_qty_after_cancel == initial_qty, f"Stock restore mismatch! Got {actual_qty_after_cancel}, expected {initial_qty}"

    # TEST 3: Idempotency Check (Cancelling again must NOT restock twice)
    print("\n--- Testing Idempotency (Preventing Double Restock) ---")
    await OrderController.update_status(
        order_id=order_id,
        update_in=OrderUpdateStatus(status=OrderStatus.CANCELLED, note="Cancelled again"),
    )
    v_after_second_cancel = await db["product_variants"].find_one({"_id": ObjectId(v_id)})
    actual_qty_after_second = int(v_after_second_cancel["available_quantity"])
    print(f"   Stock after duplicate cancellation: {actual_qty_after_second} (Expected: {initial_qty})")
    assert actual_qty_after_second == initial_qty, "Double-restocking bug detected!"

    # TEST 4: Stock Replenishment on Product Return (RETURNED)
    print("\n--- Testing Product Return Restock (RETURNED) ---")
    return_test_qty = 1
    order_in_2 = OrderCreate(
        customer_id="guest",
        items=[
            OrderItem(
                product_id=p_id,
                variant_id=v_id,
                name="Return Test Outfit",
                sku=sku,
                unit_price=5000.0,
                quantity=return_test_qty,
                total_price=5000.0,
                color=color,
                size=size,
            )
        ],
        subtotal=5000.0,
        delivery_fee=0.0,
        total=5000.0,
        currency="PKR",
        address_snapshot=AddressSnapshot(
            full_name="Sara Return Shopper",
            phone="+923001234567",
            street_address="House 2, Test Avenue",
            city="Karachi",
        ),
        status=OrderStatus.PENDING,
    )
    created_2 = await OrderController.create_order(order_in_2)
    order_id_2 = created_2["id"]
    order_number_2 = created_2["order_number"]

    # Stock should be initial_qty - 1
    v_mid = await db["product_variants"].find_one({"_id": ObjectId(v_id)})
    assert int(v_mid["available_quantity"]) == initial_qty - return_test_qty

    # Advance to DELIVERED
    await db["orders"].update_one({"_id": ObjectId(order_id_2)}, {"$set": {"status": "DELIVERED"}})

    # Customer returns outfit -> status updated to RETURNED
    await OrderController.update_status(
        order_id=order_id_2,
        update_in=OrderUpdateStatus(status=OrderStatus.RETURNED, note="Size exchange return received at warehouse"),
    )
    v_after_return = await db["product_variants"].find_one({"_id": ObjectId(v_id)})
    actual_qty_after_return = int(v_after_return["available_quantity"])
    print(f"   Stock after RETURNED: {actual_qty_after_return} (Expected: {initial_qty})")
    assert actual_qty_after_return == initial_qty, f"Return restock failed! Got {actual_qty_after_return}, expected {initial_qty}"

    # TEST 5: Out of stock prevention
    print("\n--- Testing Out of Stock Prevention ---")
    excessive_qty = actual_qty_after_return + 100
    order_excessive = OrderCreate(
        customer_id="guest",
        items=[
            OrderItem(
                product_id=p_id,
                variant_id=v_id,
                name="Excessive Quantity Outfit",
                sku=sku,
                unit_price=1000.0,
                quantity=excessive_qty,
                total_price=1000.0 * excessive_qty,
                color=color,
                size=size,
            )
        ],
        subtotal=1000.0 * excessive_qty,
        delivery_fee=0.0,
        total=1000.0 * excessive_qty,
        currency="PKR",
        address_snapshot=AddressSnapshot(
            full_name="Excessive Shopper",
            phone="+923001234567",
            street_address="House 99",
            city="Islamabad",
        ),
        status=OrderStatus.PENDING,
    )
    try:
        await OrderController.create_order(order_excessive)
        assert False, "Order with excessive stock should have been rejected!"
    except Exception as e:
        print(f"[TEST 5 PASS] Correctly rejected excessive order: {e.detail if hasattr(e, 'detail') else e}")

    # Clean up test orders
    await db["orders"].delete_many({"_id": {"$in": [ObjectId(order_id), ObjectId(order_id_2)]}})
    print("\n=== ALL 5 INVENTORY & STOCK SCENARIO TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
