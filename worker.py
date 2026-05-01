from __future__ import annotations

import json
import os
import time
from pathlib import Path

import boto3
from botocore.client import Config
import pika

from img_to_prompt import generate_prompt


RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "transcription"
EXCHANGE_TYPE = "topic"
REQUEST_QUEUE = "transcription.requests"
REQUEST_ROUTING_KEY = "transcription.request"
PROCESSING_ROUTING_KEY = "transcription.processing"
PROGRESS_ROUTING_KEY = "transcription.progress"
COMPLETED_ROUTING_KEY = "transcription.completed"
FAILED_ROUTING_KEY = "transcription.failed"
WORKER_INPUT_DIR = Path(os.getenv("WORKER_INPUT_DIR", "/app/data"))

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "bleep-jobs")

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=f"http://{MINIO_ENDPOINT}",
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version='s3v4')
    )

def ensure_bucket_exists(s3_client):
    try:
        s3_client.head_bucket(Bucket=MINIO_BUCKET)
    except Exception:
        s3_client.create_bucket(Bucket=MINIO_BUCKET)

def parse_amqp_url(url: str) -> pika.URLParameters:
    return pika.URLParameters(url)


def publish_event(channel: pika.adapters.blocking_connection.BlockingChannel, routing_key: str, payload: dict) -> None:
    channel.basic_publish(
        exchange=EXCHANGE_NAME,
        routing_key=routing_key,
        body=json.dumps(payload).encode("utf-8"),
        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
    )


def resolve_image_path(raw_path: str | None) -> Path:
    if not raw_path:
        raise ValueError("imagePath is required")

    candidate = Path(raw_path)
    if candidate.is_absolute() and candidate.exists():
        return candidate

    relative_candidate = WORKER_INPUT_DIR / raw_path.lstrip("/\\")
    if relative_candidate.exists():
        return relative_candidate

    if candidate.exists():
        return candidate

    raise FileNotFoundError(f"Image not found: {raw_path}")


def process_message(channel: pika.adapters.blocking_connection.BlockingChannel, method, properties, body: bytes) -> None:
    payload = json.loads(body.decode("utf-8"))
    job_id = payload["jobId"]
    user_id = payload["userId"]
    image_path = payload.get("imagePath")

    try:
        publish_event(
            channel,
            PROCESSING_ROUTING_KEY,
            {
                "jobId": job_id,
                "userId": user_id,
                "status": "PROCESSING",
                "progress": 0,
                "message": "processing started",
            },
        )

        publish_event(
            channel,
            PROGRESS_ROUTING_KEY,
            {
                "jobId": job_id,
                "userId": user_id,
                "status": "PROCESSING",
                "progress": 10,
                "message": "loading image",
            },
        )

        time.sleep(1)
        resolved_path = resolve_image_path(image_path)

        publish_event(
            channel,
            PROGRESS_ROUTING_KEY,
            {
                "jobId": job_id,
                "userId": user_id,
                "status": "PROCESSING",
                "progress": 60,
                "message": "running image captioning",
            },
        )

        prompt = generate_prompt(resolved_path)

        s3_client = get_s3_client()
        s3_key = f"jobs/{job_id}/result.txt"
        s3_client.put_object(
            Bucket=MINIO_BUCKET,
            Key=s3_key,
            Body=prompt.encode('utf-8')
        )

        publish_event(
            channel,
            COMPLETED_ROUTING_KEY,
            {
                "jobId": job_id,
                "userId": user_id,
                "status": "DONE",
                "progress": 100,
                "s3Key": s3_key,
            },
        )
    except Exception as exc:  # noqa: BLE001
        publish_event(
            channel,
            FAILED_ROUTING_KEY,
            {
                "jobId": job_id,
                "userId": user_id,
                "status": "ERROR",
                "error": str(exc),
            },
        )
    finally:
        channel.basic_ack(delivery_tag=method.delivery_tag)


def main() -> None:
    # Pre-load AI model to avoid delays on first job
    from img_to_prompt import get_ai_model, DEFAULT_MODEL
    get_ai_model(DEFAULT_MODEL)

    s3_client = get_s3_client()
    ensure_bucket_exists(s3_client)

    parameters = parse_amqp_url(RABBITMQ_URL)
    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()

    channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type=EXCHANGE_TYPE, durable=True)
    channel.queue_declare(queue=REQUEST_QUEUE, durable=True)
    channel.queue_bind(queue=REQUEST_QUEUE, exchange=EXCHANGE_NAME, routing_key=REQUEST_ROUTING_KEY)
    channel.basic_qos(prefetch_count=1)

    channel.basic_consume(queue=REQUEST_QUEUE, on_message_callback=process_message, auto_ack=False)
    print("[Worker] Waiting for jobs...")
    channel.start_consuming()


if __name__ == "__main__":
    main()