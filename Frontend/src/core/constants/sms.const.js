const SMS_CONST = {
  TEMPLATES: {
    WELCOME: "welcome",
    REMINDER: "reminder",
    FOLLOW_UP: "follow_up",
    BULK_NOTIFICATION: "bulk_notification",
  },
  STATUS: {
    PENDING: "pending",
    SENT: "sent",
    DELIVERED: "delivered",
    FAILED: "failed",
  },
  PROVIDER: "farazsms",
  MAX_MESSAGE_LENGTH: 320,
};

if (typeof window !== "undefined") {
  window.SMS_CONST = SMS_CONST;
}
