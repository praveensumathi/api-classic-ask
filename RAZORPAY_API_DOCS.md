# Razorpay API Endpoints

This document describes the Razorpay payment integration endpoints.

## Environment Variables Required

Make sure you have the following environment variables set in your `.env` file:

```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_SECRET_KEY=your_razorpay_secret_key
```

## Endpoints

### 1. Create Razorpay Order

**Endpoint:** `POST /payment/createRazorpayOrder`

**Description:** Creates a new Razorpay order for payment processing.

**Request Body:**
```json
{
  "amount": 1000.50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order_ABC123456789",
    "amount": 100050,
    "currency": "INR",
    "receipt": "receipt_1234567890",
    "key": "rzp_test_your_key_id"
  },
  "message": "Razorpay order created successfully"
}
```

**Notes:**
- Amount should be in rupees (e.g., 1000.50 for ₹1000.50)
- The response includes the Razorpay key needed for frontend integration
- Amount is automatically converted to paise for Razorpay

### 2. Verify Razorpay Payment

**Endpoint:** `POST /payment/verifyRazorpayPayment`

**Description:** Verifies the payment signature after successful payment.

**Request Body:**
```json
{
  "razorpay_order_id": "order_ABC123456789",
  "razorpay_payment_id": "pay_XYZ987654321",
  "razorpay_signature": "signature_hash_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "razorpay_order_id": "order_ABC123456789",
    "razorpay_payment_id": "pay_XYZ987654321",
    "verified": true
  },
  "message": "Payment verified successfully"
}
```

## Frontend Integration Example

```javascript
// 1. Create order
const createOrder = async (amount) => {
  const response = await fetch('/payment/createRazorpayOrder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount })
  });
  return response.json();
};

// 2. Initialize Razorpay payment
const initializePayment = async (amount) => {
  const orderResponse = await createOrder(amount);
  
  if (orderResponse.success) {
    const options = {
      key: orderResponse.data.key,
      amount: orderResponse.data.amount,
      currency: orderResponse.data.currency,
      name: "Your Company Name",
      description: "Payment for order",
      order_id: orderResponse.data.orderId,
      handler: function (response) {
        // Handle successful payment
        verifyPayment(response);
      },
      prefill: {
        name: "Customer Name",
        email: "customer@email.com",
        contact: "9999999999"
      },
      theme: {
        color: "#3399cc"
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
  }
};

// 3. Verify payment
const verifyPayment = async (paymentResponse) => {
  const response = await fetch('/payment/verifyRazorpayPayment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_signature: paymentResponse.razorpay_signature
    })
  });
  
  const verificationResult = await response.json();
  if (verificationResult.success) {
    // Payment verified successfully
    console.log('Payment verified!');
  }
};
```

## Error Handling

Both endpoints return appropriate error responses with status codes:

- `400`: Bad Request (invalid parameters)
- `500`: Internal Server Error (server-side issues)

Error response format:
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
``` 