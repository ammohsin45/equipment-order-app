from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import OrderRecord
from schemas import OrderCreate, OrderUpdate

app = FastAPI(
    title="Equipment Order Lookup API",
    description="FastAPI app using PostgreSQL database",
    version="4.0.0"
)

# -------------------------------------------------
# TEMP QUICK FIX FOR RAILWAY:
# Auto-create table if it does not exist.
# If you fully use Alembic later, you can remove this.
# -------------------------------------------------
Base.metadata.create_all(bind=engine)

# -------------------------------------------------
# CORS
# -------------------------------------------------
# This is okay for now because you are not using cookies/auth.
# Later you can lock it down to your exact frontend domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------
# Dependency: database session
# -------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------------------------------
# Home
# -------------------------------------------------
@app.get("/")
def home():
    return {
        "message": "PostgreSQL API is running!",
        "docs": "/docs",
        "health_check": "/health"
    }


# -------------------------------------------------
# Health check
# -------------------------------------------------
@app.get("/health")
def health():
    return {"status": "API is running successfully"}


# -------------------------------------------------
# Get all orders
# -------------------------------------------------
@app.get("/orders")
def get_all_orders(db: Session = Depends(get_db)):
    records = db.query(OrderRecord).all()

    return {
        "count": len(records),
        "data": [
            {
                "id": row.id,
                "Equipment": row.equipment,
                "Order": row.order_number,
                "Vendor": row.vendor,
                "DeliveryDate": row.delivery_date,
                "Status": row.status,
                "Notes": row.notes
            }
            for row in records
        ]
    }


# -------------------------------------------------
# Find order by equipment
# -------------------------------------------------
@app.get("/find-order/{equipment}")
def find_order(equipment: str, db: Session = Depends(get_db)):
    equipment = equipment.strip().upper()

    row = db.query(OrderRecord).filter(OrderRecord.equipment == equipment).first()

    if not row:
        raise HTTPException(status_code=404, detail="Equipment not found")

    return {
        "id": row.id,
        "Equipment": row.equipment,
        "Order": row.order_number,
        "Vendor": row.vendor,
        "DeliveryDate": row.delivery_date,
        "Status": row.status,
        "Notes": row.notes
    }


# -------------------------------------------------
# Add new order
# -------------------------------------------------
@app.post("/orders", status_code=201)
def add_order(order: OrderCreate, db: Session = Depends(get_db)):
    equipment = order.Equipment.strip().upper()
    order_number = order.Order.strip()

    existing = db.query(OrderRecord).filter(OrderRecord.equipment == equipment).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Equipment already exists with order {existing.order_number}"
        )

    new_order = OrderRecord(
        equipment=equipment,
        order_number=order_number,
        vendor=order.Vendor.strip() if order.Vendor else None,
        delivery_date=order.DeliveryDate,
        status=order.Status.strip() if order.Status else None,
        notes=order.Notes.strip() if order.Notes else None
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    return {
        "message": "Order added successfully",
        "data": {
            "id": new_order.id,
            "Equipment": new_order.equipment,
            "Order": new_order.order_number,
            "Vendor": new_order.vendor,
            "DeliveryDate": new_order.delivery_date,
            "Status": new_order.status,
            "Notes": new_order.notes
        }
    }


# -------------------------------------------------
# Update existing order
# -------------------------------------------------
@app.put("/orders/{equipment}")
def update_order(equipment: str, order_update: OrderUpdate, db: Session = Depends(get_db)):
    equipment = equipment.strip().upper()

    record = db.query(OrderRecord).filter(OrderRecord.equipment == equipment).first()

    if not record:
        raise HTTPException(status_code=404, detail="Equipment not found")

    if order_update.Order is not None:
        record.order_number = order_update.Order.strip()

    if order_update.Vendor is not None:
        record.vendor = order_update.Vendor.strip()

    if order_update.DeliveryDate is not None:
        record.delivery_date = order_update.DeliveryDate

    if order_update.Status is not None:
        record.status = order_update.Status.strip()

    if order_update.Notes is not None:
        record.notes = order_update.Notes.strip()

    db.commit()
    db.refresh(record)

    return {
        "message": "Order updated successfully",
        "data": {
            "Equipment": record.equipment,
            "Order": record.order_number,
            "Vendor": record.vendor,
            "DeliveryDate": record.delivery_date,
            "Status": record.status,
            "Notes": record.notes
        }
    }


# -------------------------------------------------
# Delete an order
# -------------------------------------------------
@app.delete("/orders/{equipment}")
def delete_order(equipment: str, db: Session = Depends(get_db)):
    equipment = equipment.strip().upper()

    record = db.query(OrderRecord).filter(OrderRecord.equipment == equipment).first()

    if not record:
        raise HTTPException(status_code=404, detail="Equipment not found")

    deleted_data = {
        "id": record.id,
        "Equipment": record.equipment,
        "Order": record.order_number,
        "Vendor": record.vendor,
        "DeliveryDate": record.delivery_date,
        "Status": record.status,
        "Notes": record.notes
    }

    db.delete(record)
    db.commit()

    return {
        "message": "Order deleted successfully",
        "deleted_data": deleted_data
    }