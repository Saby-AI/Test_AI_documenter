/**
 * Date: 07/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 *
 * PaymentService class acts as an intermediary
 * between the application and the payment gateway SDK,
 * facilitating the creation and confirmation of payment intents.
 */
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
public class PaymentService {
    private final PaymentGatewaySDK sdk; // Payment gateway SDK instance for processing payments
    /**
     * Constructor for PaymentService.
     * Initializes the PaymentGatewaySDK with the provided secret key.
     *
     * @param secretKey The secret key for authenticating requests with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount to charge, in cents. Must be positive.
     * @param currency The 3-letter currency code (e.g., "USD"). Must be valid currency format.
     * @throws PaymentException If there is an issue creating the payment intent.
     * @return The client secret string for the created payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return the client secret for use on the client-side
    }
    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @throws PaymentException If there is an issue confirming the payment.
     * @return True if the payment was successfully confirmed; otherwise, false.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}