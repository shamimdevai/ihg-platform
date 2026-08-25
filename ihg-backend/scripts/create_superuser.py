"""CLI to create the initial superadmin staff account (is_superadmin=True, is_active=True).

Requires `make seed` (or scripts/seed_data.py) to have already been run, since this
script assigns the seeded "Admin" role.

Usage:
    python scripts/create_superuser.py --email admin@ihg-platform.com --password "SuperAdmin" --first-name Admin --last-name User
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import hash_password  # noqa: E402
from app.db.connection import AsyncSessionLocal  # noqa: E402
from app.domains.iam.repositories import role_repository, staff_user_repository  # noqa: E402


async def create_superuser(*, email: str, password: str, first_name: str, last_name: str) -> None:
    """Create a staff_user with is_superadmin=True, assigned to the "Admin" role."""
    async with AsyncSessionLocal() as db:
        existing = await staff_user_repository.get_by_email(db, email)
        if existing is not None:
            print(f"A staff account with email '{email}' already exists. Aborting.")
            return

        admin_role = await role_repository.get_by_name(db, "Admin")
        if admin_role is None:
            print('The "Admin" role does not exist. Run `make seed` first.')
            return

        staff = await staff_user_repository.create(
            db,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role_id=admin_role.id,
            password_hash=hash_password(password),
            is_active=True,
            is_superadmin=True,
        )
        await db.commit()
        print(f"Superadmin created: {staff.email} (id={staff.id})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the initial superadmin staff account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    args = parser.parse_args()

    asyncio.run(
        create_superuser(
            email=args.email, password=args.password, first_name=args.first_name, last_name=args.last_name
        )
    )


if __name__ == "__main__":
    main()