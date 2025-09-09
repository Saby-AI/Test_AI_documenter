/**
 * Date: 09/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 *
 * PaymentService handles payment transactions by interacting with the PaymentGatewaySDK.
 * It allows creating and confirming payment intents.
 *
 * Responsibilities:
 * - Create payment intents based on amount and currency.
 * - Confirm payment using a payment intent ID.
 */
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
public class PaymentService {
    // The SDK used to interact with the payment gateway service
    private final PaymentGatewaySDK sdk;
    /**
     * Constructor for PaymentService.
     * Initializes the SDK with the provided secret key.
     *
     * @param secretKey The secret key for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount to charge, expressed in cents.
     * @param currency The currency code (e.g., "USD").
     * @return A client secret or unique ID for the created payment intent.
     * @throws PaymentException if the payment intent could not be created.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return the client secret for client-side use
    }
    /**
     * Confirms a payment using the associated payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return True if the payment was confirmed successfully; false otherwise.
     * @throws PaymentException if the confirmation process fails.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}