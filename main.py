import math
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from database import SessionLocal, engine, Base
from models import OrderRecord
from schemas import OrderCreate, OrderUpdate

app = FastAPI(
    title="Equipment Order Lookup API",
    description="FastAPI app using PostgreSQL database",
    version="5.2.0"
)

# Auto-create table if missing
Base.metadata.create_all(bind=engine)

# CORS
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
# Helper functions
# -------------------------------------------------
def clean_text(value):
    if value is None:
        return None

    if pd.isna(value):
        return None

    text = str(value).strip()

    if text == "" or text.lower() == "nan":
        return None

    return text


def clean_equipment(value):
    text = clean_text(value)
    if text:
        return text.upper()
    return None


def safe_date(value):
    """
    Convert Excel / pandas values safely to Python date or None.
    """
    if value is None:
        return None

    if pd.isna(value):
        return None

    parsed = pd.to_datetime(value, errors="coerce")

    if pd.isna(parsed):
        return None

    return parsed.date()


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
# Dashboard summary
# -------------------------------------------------
@app.get("/orders/summary")
def orders_summary(db: Session = Depends(get_db)):
    total = db.query(OrderRecord).count()
    open_count = db.query(OrderRecord).filter(func.lower(OrderRecord.status) == "open").count()
    pending_count = db.query(OrderRecord).filter(func.lower(OrderRecord.status) == "pending").count()
    closed_count = db.query(OrderRecord).filter(func.lower(OrderRecord.status) == "closed").count()
    cancelled_count = db.query(OrderRecord).filter(func.lower(OrderRecord.status) == "cancelled").count()

    return {
        "total": total,
        "open": open_count,
        "pending": pending_count,
        "closed": closed_count,
        "cancelled": cancelled_count
    }


# -------------------------------------------------
# Get paginated orders
# -------------------------------------------------
@app.get("/orders")
def get_all_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query(None),
    status: str = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(OrderRecord)

    if search:
        search_text = f"%{search.strip()}%"
        query = query.filter(
            or_(
                OrderRecord.equipment.ilike(search_text),
                OrderRecord.order_number.ilike(search_text),
                OrderRecord.vendor.ilike(search_text),
                OrderRecord.notes.ilike(search_text)
            )
        )

    if status and status.lower() != "all":
        query = query.filter(func.lower(OrderRecord.status) == status.lower())

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    records = (
        query.order_by(OrderRecord.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
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
    equipment = clean_equipment(order.Equipment)
    order_number = clean_text(order.Order)

    if not equipment or not order_number:
        raise HTTPException(status_code=400, detail="Equipment and Order are required")

    existing = db.query(OrderRecord).filter(OrderRecord.equipment == equipment).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Equipment already exists with order {existing.order_number}"
        )

    new_order = OrderRecord(
        equipment=equipment,
        order_number=order_number,
        vendor=clean_text(order.Vendor),
        delivery_date=order.DeliveryDate,
        status=clean_text(order.Status),
        notes=clean_text(order.Notes)
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
        record.order_number = clean_text(order_update.Order)

    if order_update.Vendor is not None:
        record.vendor = clean_text(order_update.Vendor)

    if order_update.DeliveryDate is not None:
        record.delivery_date = order_update.DeliveryDate

    if order_update.Status is not None:
        record.status = clean_text(order_update.Status)

    if order_update.Notes is not None:
        record.notes = clean_text(order_update.Notes)

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


# -------------------------------------------------
# Import Excel into DB
# -------------------------------------------------
@app.post("/orders/import-excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename.lower()

    if not filename.endswith(".xlsx") and not filename.endswith(".xls"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an Excel file (.xlsx or .xls)"
        )

    try:
        contents = await file.read()
        excel_data = BytesIO(contents)

        if filename.endswith(".xlsx"):
            df = pd.read_excel(excel_data, engine="openpyxl")
        else:
            df = pd.read_excel(excel_data, engine="xlrd")

        required_columns = {"Equipment", "Order"}
        if not required_columns.issubset(df.columns):
            raise HTTPException(
                status_code=400,
                detail="Excel must contain at least columns: Equipment and Order"
            )

        # Add optional columns if missing
        optional_columns = ["Vendor", "DeliveryDate", "Status", "Notes"]
        for col in optional_columns:
            if col not in df.columns:
                df[col] = None

        inserted = 0
        updated = 0

        for _, row in df.iterrows():
            equipment = clean_equipment(row.get("Equipment"))
            order_number = clean_text(row.get("Order"))
            vendor = clean_text(row.get("Vendor"))
            status = clean_text(row.get("Status"))
            notes = clean_text(row.get("Notes"))
            delivery_date = safe_date(row.get("DeliveryDate"))

            # Skip invalid rows
            if not equipment or not order_number:
                continue

            existing = db.query(OrderRecord).filter(
                OrderRecord.equipment == equipment
            ).first()

            if existing:
                existing.order_number = order_number
                existing.vendor = vendor
                existing.delivery_date = delivery_date
                existing.status = status
                existing.notes = notes
                updated += 1
            else:
                new_order = OrderRecord(
                    equipment=equipment,
                    order_number=order_number,
                    vendor=vendor,
                    delivery_date=delivery_date,
                    status=status,
                    notes=notes
                )
                db.add(new_order)
                inserted += 1

        db.commit()

        return {
            "message": "Excel imported successfully",
            "inserted": inserted,
            "updated": updated,
            "total_processed": inserted + updated
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )
