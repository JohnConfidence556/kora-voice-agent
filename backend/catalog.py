# Demo catalogue of plans a user can buy.
# Prices and sizes are copied from data/mtn-data-plans-overview.pdf.
# If you change a price here, change the PDF too (and the other way round).
# 1GB = 1024MB, matching how the dashboard displays data.

DATA_PLANS = [
    {"id": "daily-500mb", "name": "500MB Daily Plan", "price": 350, "data_mb": 500, "validity_days": 1},
    {"id": "2day-2gb", "name": "2GB 2-Day Plan", "price": 750, "data_mb": 2048, "validity_days": 2},
    {"id": "weekly-1gb", "name": "1GB Weekly Plan", "price": 800, "data_mb": 1024, "validity_days": 7},
    {"id": "weekly-3-5gb", "name": "3.5GB Weekly Plan", "price": 1500, "data_mb": 3584, "validity_days": 7},
    {"id": "weekly-11gb", "name": "11GB Weekly Plan", "price": 3500, "data_mb": 11264, "validity_days": 7},
    {"id": "monthly-7gb", "name": "7GB Monthly Plan", "price": 3500, "data_mb": 7168, "validity_days": 30},
    {"id": "monthly-12-5gb", "name": "12.5GB Monthly Plan", "price": 5500, "data_mb": 12800, "validity_days": 30},
]

AIRTIME_MIN = 50
AIRTIME_MAX = 5000