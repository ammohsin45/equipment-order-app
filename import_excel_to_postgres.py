import pandas as pd
from sqlalchemy.dialects.postgresql import insert

from database import engine, SessionLocal, Base
from models import OrderRecord

EXCEL_FILE = "orders.xlsx"

def import_excel():
    # Make sure metadata exists
    Base.metadata.create_all(bind=engine)

    df = pd.read_excel(EXCEL_FILE, engine="openpyxl")

    required_columns = {"Equipment", "Order"}
    if not required_columns.issubset(df.columns):
        raise ValueError("Excel file must contain at least: Equipment and Order")

    # Add optional columns if missing
    optional_columns = ["Vendor", "DeliveryDate", "Status", "Notes"]
    for col in optional_columns:
        if col not in df.columns:
            df[col] = None

    # Clean required columns
    df["Equipment"] = df["Equipment"].astype(str).str.strip().str.upper()
    df["Order"] = df["Order"].astype(str).str.strip()

    # Clean optional string columns
    df["Vendor"] = df["Vendor"].astype(str).str.strip().replace({"nan": None, "": None})
    df["Status"] = df["Status"].astype(str).str.strip().replace({"nan": None, "": None})
    df["Notes"] = df["Notes"].astype(str).str.strip().replace({"nan": None, "": None})

    # Convert date column safely
    df["DeliveryDate"] = pd.to_datetime(df["DeliveryDate"], errors="coerce").dt.date

    # Remove blank required rows
    df = df[(df["Equipment"] != "") & (df["Order"] != "")]

    # Remove duplicates in Excel
    df = df.drop_duplicates(subset=["Equipment"], keep="last")

    db = SessionLocal()

    try:
        for _, row in df.iterrows():
            stmt = insert(OrderRecord).values(
                equipment=row["Equipment"],
                order_number=row["Order"],
                vendor=row["Vendor"],
                delivery_date=row["DeliveryDate"],
                status=row["Status"],
                notes=row["Notes"]
            )

            stmt = stmt.on_conflict_do_update(
                index_elements=[OrderRecord.equipment],
                set_={
                    "order_number": stmt.excluded.order_number,
                    "vendor": stmt.excluded.vendor,
                    "delivery_date": stmt.excluded.delivery_date,
                    "status": stmt.excluded.status,
                    "notes": stmt.excluded.notes
                }
            )

            db.execute(stmt)

        db.commit()
        print(f"Import complete. Imported/updated {len(df)} rows successfully.")

    except Exception as e:
        db.rollback()
        print("Import failed:", str(e))
        raise

    finally:
        db.close()


if __name__ == "__main__":
    import_excel()
