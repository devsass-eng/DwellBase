"""Database migration & initial seeder for DwellBase (FastAPI + Neon PostgreSQL).

Creates tables from SQLAlchemy ORM models and seeds:
- Platform Settings
- Default Super Admin
- Default Landlord with initial approved one-time access fee
- Default Billing Categories
"""

import asyncio
import os
import bcrypt
from datetime import datetime, timezone, date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select, text
from backend.database import engine, AsyncSessionLocal
from backend.models import (
    Base,
    SuperAdmin,
    PlatformSetting,
    Landlord,
    LandlordAccessPayment,
    BillingCategory,
)
from backend.config import get_settings


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


async def run_migrations():
    print("Running DwellBase database migration...")
    settings = get_settings()

    # 1. Create tables if they do not exist
    async with engine.begin() as conn:
        print("Ensuring tables exist via SQLAlchemy metadata...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables verified/created successfully.")

    async with AsyncSessionLocal() as session:
        # 2. Seed Platform Settings
        default_settings = [
            ("one_time_fee", "500.00", "Standard one-time landlord account access fee in Ghana Cedis (GH₵)"),
            ("platform_name", "DwellBase", "Platform branding name"),
            ("tagline", "Property Management Made Simple.", "Platform official tagline"),
            ("contact_phone", "024 123 4567", "Super Admin direct telephone for prospective landlord inquiries"),
            ("contact_email", "owner@dwellbase.com", "Super Admin direct email address"),
            ("contact_momo_number", "054 400 4400", "Direct Mobile Money transfer number for one-time fee"),
            ("contact_momo_name", "DwellBase Platform Owner", "Registered name on Mobile Money account"),
            (
                "contact_instructions",
                "To obtain access to DwellBase, please contact the platform owner to arrange cash payment or direct Mobile Money transfer. After independent verification, your permanent account will be activated.",
                "Instructions displayed to prospective landlords",
            ),
        ]

        for key, val, desc in default_settings:
            res = await session.execute(select(PlatformSetting).where(PlatformSetting.key == key))
            if not res.scalar_one_or_none():
                session.add(PlatformSetting(key=key, value=val, description=desc))
                print(f"Seeded platform setting: {key}")

        await session.commit()

        # 3. Seed Default Super Admin
        super_email = os.environ.get("SUPERADMIN_EMAIL", "superadmin@dwellbase.com").strip().lower()
        super_pwd = os.environ.get("SUPERADMIN_PASSWORD", "SuperAdmin@1234")
        super_name = os.environ.get("SUPERADMIN_NAME", "System Super Administrator")

        res = await session.execute(select(SuperAdmin).where(SuperAdmin.email == super_email))
        superadmin = res.scalar_one_or_none()
        if not superadmin:
            superadmin = SuperAdmin(
                id=uuid4(),
                full_name=super_name,
                email=super_email,
                password_hash=hash_password(super_pwd),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(superadmin)
            print(f"Created Super Admin account: {super_email} (password: {super_pwd})")
        else:
            print(f"Super Admin account already exists: {super_email}")

        await session.commit()

        # 4. Seed Default Landlord
        ll_email = os.environ.get("SEED_EMAIL", "admin@dwellbase.com").strip().lower()
        ll_pwd = os.environ.get("SEED_PASSWORD", "Admin@1234")
        ll_name = os.environ.get("SEED_NAME", "Property Manager")
        ll_prop = os.environ.get("SEED_PROPERTY", "DwellBase Property")

        res = await session.execute(select(Landlord).where(Landlord.email == ll_email))
        landlord = res.scalar_one_or_none()

        if landlord:
            landlord.is_paid = True
            landlord.account_status = "Active"
            if not landlord.payment_approved_at:
                landlord.payment_approved_at = datetime.now(timezone.utc)
            if not landlord.account_activated_at:
                landlord.account_activated_at = datetime.now(timezone.utc)
            landlord_id = landlord.id
            print(f"Landlord account updated to Paid & Active: {ll_email}")
        else:
            landlord_id = uuid4()
            landlord = Landlord(
                id=landlord_id,
                landlord_code="LL-001",
                full_name=ll_name,
                email=ll_email,
                password_hash=hash_password(ll_pwd),
                property_name=ll_prop,
                one_time_fee=Decimal("500.00"),
                is_paid=True,
                payment_approved_at=datetime.now(timezone.utc),
                account_activated_at=datetime.now(timezone.utc),
                account_status="Active",
                currency="GHS",
                currency_symbol="GH₵",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(landlord)
            print(f"Created active landlord account: {ll_email} (password: {ll_pwd})")

        await session.commit()

        # 5. Ensure Default Landlord Access Payment
        res = await session.execute(
            select(LandlordAccessPayment).where(LandlordAccessPayment.landlord_id == landlord_id)
        )
        if not res.scalar_one_or_none():
            payment = LandlordAccessPayment(
                id=uuid4(),
                payment_id="OTP-INITIAL-001",
                landlord_id=landlord_id,
                landlord_name=ll_name,
                landlord_email=ll_email,
                amount=Decimal("500.00"),
                payment_method="cash",
                date_received=date.today(),
                external_reference="INITIAL-PROVISION",
                receipt_number="REC-001",
                status="approved",
                recorded_by="Super Administrator",
                approved_by="Super Administrator",
                approval_date=datetime.now(timezone.utc),
                notes="Initial setup demonstration landlord",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(payment)
            print("Recorded approved initial one-time access payment for landlord")

        await session.commit()

        # 6. Seed Default Billing Categories
        categories = [
            ("Rent", "Monthly/Yearly room rent", "yearly", 7),
            ("Light Bill", "Electricity charges", "monthly", 7),
            ("Water Bill", "Water supply charges", "monthly", 7),
        ]
        for name, desc, freq, grace in categories:
            res = await session.execute(
                select(BillingCategory).where(
                    BillingCategory.landlord_id == landlord_id,
                    BillingCategory.name == name,
                )
            )
            if not res.scalar_one_or_none():
                cat = BillingCategory(
                    id=uuid4(),
                    landlord_id=landlord_id,
                    name=name,
                    description=desc,
                    billing_frequency=freq,
                    is_default=True,
                    grace_period_days=grace,
                    status="active",
                    created_at=datetime.now(timezone.utc),
                )
                session.add(cat)
                print(f"Added default category: {name}")

        await session.commit()

    print("DwellBase migration completed successfully.")


if __name__ == "__main__":
    asyncio.run(run_migrations())
