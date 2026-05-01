const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672/";
const EXCHANGE_NAME = "transcription";
const EXCHANGE_TYPE = "topic";
const QUEUE_NAME = "transcription.requests";
const ROUTING_KEY = "transcription.request";
const EVENT_QUEUE_NAME = "transcription.backend.events";
const EVENT_ROUTING_KEYS = [
  "transcription.processing",
  "transcription.progress",
  "transcription.completed",
  "transcription.failed",
];

let connection = null;
let channel = null;

async function connectBroker(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      // Declare exchange
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });

      // Declare queue
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      // Bind queue to exchange
      await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

      console.log("[Broker] Connected to RabbitMQ successfully");

      // Handle connection close
      connection.on("error", (err) => {
        console.error("[Broker] Connection error:", err);
        channel = null;
        connection = null;
      });

      connection.on("close", () => {
        console.log("[Broker] Connection closed");
        channel = null;
        connection = null;
      });

      return channel;
    } catch (error) {
      console.error(`[Broker] Failed to connect (attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        console.log(`[Broker] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

async function publishMessage(message) {
  if (!channel) {
    throw new Error("Broker channel is not initialized");
  }

  const payload = JSON.stringify(message);
  const sent = channel.publish(EXCHANGE_NAME, ROUTING_KEY, Buffer.from(payload), {
    persistent: true,
    contentType: "application/json",
  });

  if (!sent) {
    throw new Error("Failed to publish message to broker");
  }

  console.log("[Broker] Published message:", message.jobId, "with idempotencyKey:", message.idempotencyKey);
  return true;
}

async function subscribeToWorkerEvents(handler) {
  if (!channel) {
    throw new Error("Broker channel is not initialized");
  }

  await channel.assertQueue(EVENT_QUEUE_NAME, { durable: true });
  for (const routingKey of EVENT_ROUTING_KEYS) {
    await channel.bindQueue(EVENT_QUEUE_NAME, EXCHANGE_NAME, routingKey);
  }

  await channel.prefetch(10);

  await channel.consume(EVENT_QUEUE_NAME, async (message) => {
    if (!message) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString("utf8"));
      await handler(payload, message.fields.routingKey);
      channel.ack(message);
    } catch (error) {
      console.error("[Broker] Failed to handle worker event:", error);
      channel.nack(message, false, false);
    }
  });

  console.log("[Broker] Subscribed to worker events");
}

async function closeBroker() {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
  console.log("[Broker] Closed connection");
}

module.exports = {
  connectBroker,
  publishMessage,
  subscribeToWorkerEvents,
  closeBroker,
  EXCHANGE_NAME,
  EXCHANGE_TYPE,
  QUEUE_NAME,
  ROUTING_KEY,
  EVENT_QUEUE_NAME,
  EVENT_ROUTING_KEYS,
};
