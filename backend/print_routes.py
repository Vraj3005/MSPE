from backend.app.main import app

print("Registered Routes:")
for route in app.routes:
    print(f"Path: {route.path} | Name: {route.name} | Methods: {getattr(route, 'methods', None)}")
