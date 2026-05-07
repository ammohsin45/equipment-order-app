from sqlalchemy import Column, Integer, String, Date
from database import Base


class OrderRecord(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    equipment = Column(String, unique=True, index=True, nullable=False)
    order_number = Column(String, nullable=False)
    vendor = Column(String, nullable=True)
    delivery_date = Column(Date, nullable=True)
    status = Column(String, nullable=True)
    notes = Column(String, nullable=True)