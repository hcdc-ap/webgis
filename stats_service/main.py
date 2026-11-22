# =====================================================================
# MODULE 4 — stats_service: FastAPI microservice kiểm định thống kê
# ---------------------------------------------------------------------
# CHỈ NGHE LOOPBACK (127.0.0.1) — không mở ra mạng ngoài. Node/Express là
# nơi DUY NHẤT gọi tới service này (qua route nội bộ /api/validate), sau
# khi đã xác thực người dùng là admin. Service không tự xác thực người
# dùng cuối, không nhận dữ liệu định danh (chỉ số liệu đã ẩn danh).
#
# Chạy: uvicorn main:app --host 127.0.0.1 --port 8000
# (Xem stats_service/README.md để biết cách chạy song song với Node.)
# =====================================================================
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import logging

from stats_core import run_full_validation, library_versions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stats_service")

app = FastAPI(
    title="HCDC WebGIS - Stats Validation Service",
    description="Microservice kiểm định thống kê (Module 4) — chỉ dùng nội bộ qua localhost.",
    version="1.0.0",
)


class PointIn(BaseModel):
    khong_dat: int = Field(..., ge=0, le=1)
    R: float = Field(..., ge=0.0, le=1.0)
    nhom_uu_tien: Optional[str] = None
    features: Optional[dict] = None


class ValidateRequest(BaseModel):
    points: list[PointIn]
    alpha: float = 0.05
    bootstrap_n: int = 2000
    random_state: int = 42


@app.get("/health")
def health():
    """Kiểm tra service sống + phiên bản thư viện (dùng để Node xác minh trước khi gọi)."""
    return {"status": "ok", "library_versions": library_versions()}


@app.post("/validate")
def validate(req: ValidateRequest):
    """
    Nhận danh sách điểm đã ẩn danh (khong_dat, R, nhom_uu_tien, features)
    -> chạy toàn bộ kiểm định thống kê (4.3) -> trả JSON kết quả.
    KHÔNG tự viết công thức thống kê ở đây: mọi phép tính nằm trong
    stats_core.py, gọi trực tiếp scipy/statsmodels/sklearn.
    """
    if not req.points:
        raise HTTPException(status_code=400, detail="Danh sách 'points' rỗng.")
    if len(req.points) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Cần tối thiểu 10 điểm để chạy kiểm định thống kê ổn định (nhận được {len(req.points)}).",
        )

    try:
        points_dicts = [p.model_dump() for p in req.points]
        result = run_full_validation(
            points_dicts,
            alpha=req.alpha,
            bootstrap_n=req.bootstrap_n,
            random_state=req.random_state,
        )
        return result
    except Exception as e:
        logger.exception("Lỗi khi chạy kiểm định thống kê")
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý thống kê: {e}")


if __name__ == "__main__":
    import uvicorn
    # Chỉ nghe loopback — KHÔNG dùng 0.0.0.0 để tránh mở ra mạng ngoài.
    uvicorn.run(app, host="127.0.0.1", port=8000)
