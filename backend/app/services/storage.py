"""Object storage service: MinIO/S3 dengan fallback direktori lokal."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from backend.app.config import settings

logger = logging.getLogger("tip_storage")


def _local_path(key: str) -> Path:
    base = Path(settings.LOCAL_STORAGE_DIR).resolve()
    target = (base / key).resolve()
    if not str(target).startswith(str(base)):
        raise ValueError("Path storage tidak valid")
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def _s3_client():
    if not settings.S3_ENDPOINT:
        return None
    try:
        import boto3
        from botocore.client import Config

        return boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )
    except Exception as exc:
        logger.warning("Gagal inisialisasi S3 client: %s", exc)
        return None


def put_object(key: str, data: bytes, content_type: str = "application/octet-stream", bucket: Optional[str] = None) -> str:
    """Simpan objek ke MinIO/S3 atau fallback ke disk lokal. Mengembalikan key."""
    target_bucket = bucket or settings.S3_BUCKET
    client = _s3_client()
    if client is not None:
        try:
            try:
                client.head_bucket(Bucket=target_bucket)
            except Exception:
                client.create_bucket(Bucket=target_bucket)
            client.put_object(Bucket=target_bucket, Key=key, Body=data, ContentType=content_type)
            return key
        except Exception as exc:
            logger.warning("Upload S3 gagal (%s), fallback ke lokal", exc)

    path = _local_path(key)
    path.write_bytes(data)
    return key


def get_object(key: str, bucket: Optional[str] = None) -> Optional[bytes]:
    """Ambil bytes objek dari MinIO/S3 atau disk lokal."""
    target_bucket = bucket or settings.S3_BUCKET
    client = _s3_client()
    if client is not None:
        try:
            resp = client.get_object(Bucket=target_bucket, Key=key)
            return resp["Body"].read()
        except Exception:
            pass

    path = _local_path(key)
    if path.exists():
        return path.read_bytes()
    return None
