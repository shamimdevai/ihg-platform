"""Unit tests for app.shared_kernel.services.password_reset_service.

Covers the exact contract IAM (Phase 3) and Customers (Phase 4) both depend on:
generate_token(), validate_token(), consume_token().
"""
import uuid

import pytest

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.shared_kernel.services import password_reset_service


async def test_generate_token_returns_raw_string(db_session):
    raw_token = await password_reset_service.generate_token(
        db_session, principal_type="staff", principal_id=uuid.uuid4(), purpose="reset"
    )
    assert isinstance(raw_token, str)
    assert len(raw_token) > 20


async def test_validate_token_succeeds_for_fresh_token(db_session):
    principal_id = uuid.uuid4()
    raw_token = await password_reset_service.generate_token(
        db_session, principal_type="customer", principal_id=principal_id, purpose="verify_email"
    )
    record = await password_reset_service.validate_token(db_session, raw_token=raw_token, purpose="verify_email")
    assert record.principal_id == principal_id
    assert record.principal_type == "customer"
    assert record.used_at is None


async def test_consume_token_marks_used_and_blocks_reuse(db_session):
    raw_token = await password_reset_service.generate_token(
        db_session, principal_type="staff", principal_id=uuid.uuid4(), purpose="invite"
    )
    consumed = await password_reset_service.consume_token(db_session, raw_token=raw_token, purpose="invite")
    assert consumed.used_at is not None

    with pytest.raises(ConflictError):
        await password_reset_service.consume_token(db_session, raw_token=raw_token, purpose="invite")


async def test_validate_token_wrong_purpose_raises_not_found(db_session):
    raw_token = await password_reset_service.generate_token(
        db_session, principal_type="customer", principal_id=uuid.uuid4(), purpose="reset"
    )
    with pytest.raises(NotFoundError):
        await password_reset_service.validate_token(db_session, raw_token=raw_token, purpose="invite")


async def test_validate_token_unknown_raw_token_raises_not_found(db_session):
    with pytest.raises(NotFoundError):
        await password_reset_service.validate_token(db_session, raw_token="not-a-real-token", purpose="reset")


async def test_validate_token_expired_raises_validation_error(db_session):
    raw_token = await password_reset_service.generate_token(
        db_session,
        principal_type="staff",
        principal_id=uuid.uuid4(),
        purpose="reset",
        expires_in_minutes=-1,
    )
    with pytest.raises(ValidationError):
        await password_reset_service.validate_token(db_session, raw_token=raw_token, purpose="reset")