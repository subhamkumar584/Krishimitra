import { useEffect } from "react";

// Lightweight Razorpay Checkout integration
// amountPaise is in INR subunits (e.g., 5000 = ₹50)
export default function RazorpayCheckoutButton({ amountPaise, label }: { amountPaise: number; label?: string }) {
  useEffect(() => {
    // Load Razorpay script once
    const existing = document.getElementById("razorpay-js");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "razorpay-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePay = async () => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const resp = await fetch(`${backend}/api/v1/payments/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountPaise, currency: "INR" })
    });
    const data = await resp.json();
    if (!resp.ok) {
      alert(data?.error || "Failed to create order");
      return;
    }

    const order = data.order;
    const options: any = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: "AgriConnect",
      description: "Demo Payment",
      order_id: order.id,
      handler: function (response: any) {
        alert("Payment successful: " + response.razorpay_payment_id);
      },
      prefill: { name: "Farmer", email: "farmer@example.com", contact: "9999999999" },
      theme: { color: "#0ea5e9" }
    };

    const rz = new (window as any).Razorpay(options);
    rz.open();
  };

  return (
    <button onClick={handlePay} className="btn btn-primary">
      {label || "Pay"}
    </button>
  );
}
