const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672/";
const EXCHANGE_NAME = "transcription";
const EXCHANGE_TYPE = "topic";
const QUEUE_NAME = "transcription.requests";
const ROUTING_KEY = "transcription.request";

let connection = null;
let channel = null;

async function connectBroker() {
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
    console.error("[Broker] Failed to connect:", error);
    throw error;
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
  closeBroker,
};
