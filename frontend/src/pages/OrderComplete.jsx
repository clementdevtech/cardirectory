import { useSearchParams } from "react-router-dom";

export default function OrderComplete() {
  const [params] = useSearchParams();
  const trackingId = params.get("OrderTrackingId");
  const resultCode = params.get("ResponseCode");

  return (
    <div className="text-center mt-5">
      {resultCode === "0" ? (
        <h3 className="text-success">✅ Payment Successful!</h3>
      ) : (
        <h3 className="text-danger">❌ Payment Cancelled or Failed</h3>
      )}
      <p>Order Tracking ID: {trackingId}</p>
    </div>
  );
}