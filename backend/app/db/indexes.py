"""Index definitions, created on startup. Add indexes here as features are built."""
from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import Collections

# Unique only when the field holds a string, so many users can have no email / phone
_ONLY_STRINGS = lambda field: {field: {"$type": "string"}}  # noqa: E731


async def create_indexes(db: AsyncDatabase) -> None:
    users = db[Collections.USERS]
    # An earlier version created a plain unique index on email, which would treat
    # every missing email as a duplicate. Replace it with the partial one below.
    if "email_1" in await users.index_information():
        await users.drop_index("email_1")
    await users.create_index("email", name="email_unique", unique=True, partialFilterExpression=_ONLY_STRINGS("email"))
    await users.create_index("phone", name="phone_unique", unique=True, partialFilterExpression=_ONLY_STRINGS("phone"))
    await users.create_index("role")

    students = db[Collections.STUDENTS]
    await students.create_index("user_id", unique=True)
    await students.create_index(
        "aadhaar.number_hash",
        name="aadhaar_unique",
        unique=True,
        partialFilterExpression=_ONLY_STRINGS("aadhaar.number_hash"),
    )

    # Student directory search / filters
    await students.create_index("aadhaar.taluka")
    await students.create_index("aadhaar.district")
    await students.create_index([("created_at", -1)])

    donors = db[Collections.DONORS]
    await donors.create_index("user_id", unique=True)
    await donors.create_index("pan.number_hash", name="pan_unique", unique=True, partialFilterExpression=_ONLY_STRINGS("pan.number_hash"))

    # One payment per student per month
    await db[Collections.PAYMENTS].create_index([("user_id", 1), ("period", 1)], name="one_payment_per_month", unique=True)
    await db[Collections.PAYMENTS].create_index([("period", 1), ("created_at", -1)])
    await db[Collections.FUNDS].create_index([("created_at", -1)])
    await db[Collections.DONATIONS].create_index([("user_id", 1), ("created_at", -1)])
    await db[Collections.DONATIONS].create_index("receipt_no", unique=True)
    orders = db[Collections.DONATION_ORDERS]
    await orders.create_index("razorpay_order_id", unique=True, partialFilterExpression=_ONLY_STRINGS("razorpay_order_id"))
    await orders.create_index([("created_at", -1)])

    await db[Collections.DOCUMENTS].create_index([("owner_user_id", 1), ("kind", 1)])

    # OTP requests are only needed for the hourly send limit, then MongoDB removes them
    otp = db[Collections.OTP_REQUESTS]
    await otp.create_index([("phone", 1), ("created_at", -1)])
    await otp.create_index("created_at", name="otp_expiry", expireAfterSeconds=60 * 60)

    # Placeholder examples — uncomment / adjust once the schemas are final.
    # await db[Collections.APPLICATIONS].create_index([("student_id", 1), ("scheme_id", 1)], unique=True)
