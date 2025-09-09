/**
 * Date: 07/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 *
 * PaymentService class is responsible for interacting with the PaymentGatewaySDK
 * to create and confirm payment intents.
 */
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
public class PaymentService {
    // The SDK instance for payment processing
    private final PaymentGatewaySDK sdk;
    /**
     * Constructor to initialize PaymentService with the provided secret key.
     *
     * @param secretKey the secret key for PaymentGatewaySDK initialization.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents the amount for the payment in cents.
     * @param currency the currency code as a string (e.g., "USD").
     * @return the client secret for front-end use or a unique identifier.
     * @throws PaymentException if there is an error creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }
    /**
     * Confirms the payment based on the provided payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm.
     * @return true if the payment is confirmed, otherwise false.
     * @throws PaymentException if there is an error confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}