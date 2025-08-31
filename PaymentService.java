import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

public class PaymentService {

    private final PaymentGatewaySDK sdk;

    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}
