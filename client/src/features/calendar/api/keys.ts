export const bookingKeys = {
  all: ["bookings"] as const,
  list: () => [...bookingKeys.all, "list"] as const,
}
