.PHONY: up down migrate makemigrations seed test lint

up:
	docker compose up --build

down:
	docker compose down

migrate:
	docker compose run --rm api alembic upgrade head

makemigrations:
	docker compose run --rm api alembic revision --autogenerate -m "$(m)"

seed:
	docker compose run --rm api python scripts/seed_data.py

createsuperuser:
	docker compose run --rm api python scripts/create_superuser.py --email $(email) --password $(password) --first-name $(first) --last-name $(last)

test:
	docker compose run --rm api pytest

lint:
	docker compose run --rm api sh -c "black --check . && isort --check-only . && mypy app"