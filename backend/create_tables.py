"""Create all database tables on the remote Supabase PostgreSQL instance."""
import asyncio
from backend.app.db.base import Base  # noqa — triggers all model imports
from backend.app.db.session import async_engine


async def create_tables():
    print("Connecting to Supabase PostgreSQL...")
    async with async_engine.begin() as conn:
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
    print("All tables created successfully!")
    await async_engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_tables())
