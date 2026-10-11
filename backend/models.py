"""SQLAlchemy ORM models — 1:1 mapping of the existing PostgreSQL schema."""

import uuid
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Numeric, Date, DateTime,
    ForeignKey, Index, CheckConstraint, UniqueConstraint, JSON,
    text as sa_text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ─── 1. Super Admins ─────────────────────────────────────────────────────────
class SuperAdmin(Base):
    __tablename__ = "super_admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    full_name = Column(Text, nullable=False)
    email = Column(Text, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))


# ─── 2. Platform Settings ────────────────────────────────────────────────────
class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(Text, primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(Text, default="")
    updated_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))


# ─── 3. Landlords ────────────────────────────────────────────────────────────
class Landlord(Base):
    __tablename__ = "landlords"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_code = Column(Text, unique=True)
    full_name = Column(Text, nullable=False)
    email = Column(Text, nullable=False, unique=True)
    password_hash = Column(Text)
    phone = Column(Text)
    property_name = Column(Text, default="")
    property_address = Column(Text, default="")
    one_time_fee = Column(Numeric(12, 2), default=Decimal("500.00"))
    is_paid = Column(Boolean, default=False)
    payment_approved_at = Column(DateTime(timezone=True))
    account_activated_at = Column(DateTime(timezone=True))
    account_status = Column(
        Text, nullable=False, default="Pending Payment",
    )
    suspension_reason = Column(Text, default="")
    momo_network = Column(Text, default="")
    momo_name = Column(Text, default="")
    momo_number = Column(Text, default="")
    payment_instructions = Column(Text, default="")
    notif_new_tenant = Column(Boolean, default=True)
    notif_manual_momo = Column(Boolean, default=True)
    notif_confirmed_payment = Column(Boolean, default=True)
    notif_upcoming_charges = Column(Boolean, default=False)
    notif_overdue_charges = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    # Relationships
    rooms = relationship("Room", back_populates="landlord", cascade="all, delete-orphan")
    tenants = relationship("Tenant", back_populates="landlord", cascade="all, delete-orphan")
    access_payments = relationship("LandlordAccessPayment", back_populates="landlord", cascade="all, delete-orphan")
    activation_tokens = relationship("LandlordActivationToken", back_populates="landlord", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_landlords_email", "email"),
        Index("idx_landlords_status", "account_status"),
        CheckConstraint(
            "account_status IN ('Active', 'Pending Payment', 'Pending Activation', 'Suspended')",
            name="ck_landlord_account_status",
        ),
    )


# ─── 4. Landlord Access Payments ─────────────────────────────────────────────
class LandlordAccessPayment(Base):
    __tablename__ = "landlord_access_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    payment_id = Column(Text, nullable=False, unique=True)
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    landlord_name = Column(Text, nullable=False)
    landlord_email = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Text, nullable=False)
    date_received = Column(Date, nullable=False)
    external_reference = Column(Text, default="")
    receipt_number = Column(Text, default="")
    status = Column(Text, nullable=False, default="pending_verification")
    recorded_by = Column(Text, nullable=False)
    approved_by = Column(Text)
    approval_date = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    reversal_reason = Column(Text)
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    landlord = relationship("Landlord", back_populates="access_payments")

    __table_args__ = (
        Index("idx_access_payments_landlord", "landlord_id"),
        Index("idx_access_payments_status", "status"),
        CheckConstraint(
            "payment_method IN ('cash', 'direct_momo')",
            name="ck_access_payment_method",
        ),
        CheckConstraint(
            "status IN ('pending_verification', 'approved', 'rejected', 'reversed')",
            name="ck_access_payment_status",
        ),
    )


# ─── 5. Landlord Activation Tokens ───────────────────────────────────────────
class LandlordActivationToken(Base):
    __tablename__ = "landlord_activation_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(Text, nullable=False, unique=True)
    raw_token = Column(Text)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    landlord = relationship("Landlord", back_populates="activation_tokens")

    __table_args__ = (
        Index("idx_activation_tokens_hash", "token_hash"),
    )


# ─── 6. Super Admin Audit Logs ───────────────────────────────────────────────
class SuperAdminAuditLog(Base):
    __tablename__ = "super_admin_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    super_admin_id = Column(UUID(as_uuid=True), ForeignKey("super_admins.id", ondelete="SET NULL"))
    super_admin_name = Column(Text, nullable=False)
    action = Column(Text, nullable=False)
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"))
    landlord_name = Column(Text)
    details = Column(JSON, default={})
    notes = Column(Text, default="")
    ip_address = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    __table_args__ = (
        Index("idx_super_admin_audit_landlord", "landlord_id"),
        Index("idx_super_admin_audit_action", "action"),
        Index("idx_super_admin_audit_created", "created_at"),
    )


# ─── 7. Rooms ────────────────────────────────────────────────────────────────
class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    sequence_number = Column(Integer, nullable=False)
    room_number = Column(Text, nullable=False)
    room_code = Column(Text, nullable=False)
    monthly_rent = Column(Numeric(12, 2), nullable=False)
    status = Column(Text, nullable=False, default="Vacant")
    archived = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    landlord = relationship("Landlord", back_populates="rooms")
    tenants = relationship("Tenant", back_populates="room")

    __table_args__ = (
        UniqueConstraint("landlord_id", "room_code", name="uq_room_landlord_code"),
        Index("idx_rooms_landlord", "landlord_id"),
        CheckConstraint(
            "status IN ('Vacant', 'Occupied', 'Maintenance')",
            name="ck_room_status",
        ),
    )


# ─── 8. Tenants ──────────────────────────────────────────────────────────────
class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(Text, nullable=False)
    full_name = Column(Text, nullable=False)
    phone = Column(Text)
    email = Column(Text)
    password_hash = Column(Text)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id"))
    room_number = Column(Text)
    room_code = Column(Text)
    monthly_rent = Column(Numeric(12, 2))
    start_date = Column(Date)
    duration_months = Column(Integer)
    end_date = Column(Date)
    total_contractual_rent = Column(Numeric(12, 2), default=Decimal("0"))
    amount_paid = Column(Numeric(12, 2), default=Decimal("0"))
    outstanding_balance = Column(Numeric(12, 2), default=Decimal("0"))
    tenancy_status = Column(Text, default="Upcoming")
    account_status = Column(Text, default="Not Set Up")
    notif_payment_confirmations = Column(Boolean, default=True)
    notif_manual_momo = Column(Boolean, default=True)
    notif_upcoming_bills = Column(Boolean, default=False)
    notif_overdue_charges = Column(Boolean, default=True)
    notif_new_regulations = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    landlord = relationship("Landlord", back_populates="tenants")
    room = relationship("Room", back_populates="tenants")

    __table_args__ = (
        UniqueConstraint("landlord_id", "tenant_id", name="uq_tenant_landlord_tid"),
        Index("idx_tenants_landlord", "landlord_id"),
        Index("idx_tenants_room", "room_id"),
        CheckConstraint(
            "tenancy_status IN ('Upcoming', 'Active', 'Expiring Soon', 'Expired', 'Ended')",
            name="ck_tenant_tenancy_status",
        ),
        CheckConstraint(
            "account_status IN ('Not Set Up', 'Invitation Pending', 'Active', 'Suspended')",
            name="ck_tenant_account_status",
        ),
    )


# ─── 9. Billing Categories ───────────────────────────────────────────────────
class BillingCategory(Base):
    __tablename__ = "billing_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, default="")
    billing_frequency = Column(Text, nullable=False)
    custom_interval_months = Column(Integer)
    default_amount = Column(Numeric(12, 2))
    is_default = Column(Boolean, default=False)
    status = Column(Text, default="active")
    grace_period_days = Column(Integer, default=7)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    __table_args__ = (
        CheckConstraint(
            "billing_frequency IN ('monthly', 'yearly', 'custom')",
            name="ck_billing_frequency",
        ),
        CheckConstraint(
            "status IN ('active', 'archived')",
            name="ck_billing_status",
        ),
    )


# ─── 10. Charges ─────────────────────────────────────────────────────────────
class Charge(Base):
    __tablename__ = "charges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("billing_categories.id"))
    category_name = Column(Text, nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))
    tenant_name = Column(Text, nullable=False)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id"))
    room_number = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), default=Decimal("0"))
    remaining_balance = Column(Numeric(12, 2), nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    billing_period = Column(Text, nullable=False)
    status = Column(Text, default="upcoming")
    issued_by = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    __table_args__ = (
        Index("idx_charges_landlord", "landlord_id"),
        Index("idx_charges_tenant", "tenant_id"),
        CheckConstraint(
            "status IN ('upcoming', 'pending', 'overdue', 'paid', 'partially_paid')",
            name="ck_charge_status",
        ),
    )


# ─── 11. Payments ────────────────────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    reference_number = Column(Text, nullable=False, unique=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))
    tenant_name = Column(Text, nullable=False)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id"))
    room_number = Column(Text, nullable=False)
    charge_id = Column(UUID(as_uuid=True), ForeignKey("charges.id"))
    category_id = Column(UUID(as_uuid=True), ForeignKey("billing_categories.id"))
    category_name = Column(Text, nullable=False)
    billing_period = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Text, nullable=False)
    momo_network = Column(Text)
    provider_ref = Column(Text)
    status = Column(Text, default="pending")
    recorded_by = Column(Text, nullable=False)
    payment_date = Column(Date, nullable=False)
    notes = Column(Text)
    receipt_ref = Column(Text)
    receipt_number = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    __table_args__ = (
        Index("idx_payments_landlord", "landlord_id"),
        Index("idx_payments_tenant", "tenant_id"),
        Index("idx_payments_charge", "charge_id"),
        CheckConstraint(
            "payment_method IN ('cash', 'momo')",
            name="ck_payment_method",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'successful', 'failed', 'reversed', 'pending_sync')",
            name="ck_payment_status",
        ),
    )


# ─── 12. Regulations ─────────────────────────────────────────────────────────
class Regulation(Base):
    __tablename__ = "regulations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    __table_args__ = (
        Index("idx_regulations_landlord", "landlord_id"),
    )


# ─── 13. Audit Logs ──────────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa_text("gen_random_uuid()"))
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(Text, nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    field = Column(Text, nullable=False)
    original_value = Column(Text)
    corrected_value = Column(Text)
    actor = Column(Text, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=sa_text("NOW()"))

    __table_args__ = (
        Index("idx_audit_landlord", "landlord_id"),
        CheckConstraint(
            "entity_type IN ('payment', 'charge', 'tenant')",
            name="ck_audit_entity_type",
        ),
    )
