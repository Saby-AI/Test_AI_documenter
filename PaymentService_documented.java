```java
/*
Date: 27/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
/**
 * PaymentService is responsible for handling payment processing operations
 * using the PaymentGatewaySDK. It provides methods to create and confirm
 * payment intents.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructs a PaymentService with the specified secret key.
     *
     * @param secretKey The secret key used to authenticate with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount to be charged, in cents.
     * @param currency The currency code (e.g., "USD").
     * @return The client secret for the payment intent, used for client-side operations.
     * @throws PaymentException If there is an error creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Returns the client secret for client-side use
    }
    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException If there is an error confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}
```