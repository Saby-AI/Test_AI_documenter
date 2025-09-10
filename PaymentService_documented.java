/**
 * Date: 10/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 *
 * The PaymentService class provides methods for interacting with the PaymentGatewaySDK
 * to create and confirm payment intents. This class abstracts the complexities of the
 * payment processing system, allowing easy integration for payment transactions.
 */
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
public class PaymentService {
    private final PaymentGatewaySDK sdk; // SDK instance for managing payment-related operations
    /**
     * Constructor for PaymentService.
     *
     * @param secretKey The secret key to authenticate with the Payment Gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey); // Initialize the PaymentGatewaySDK with the provided secret key
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount in cents for the payment intent.
     * @param currency      The currency code (e.g., "USD", "EUR").
     * @return A string representing the client secret or unique ID for client-side use.
     * @throws PaymentException If an error occurs while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency); // Sends request to create a payment intent
        return intent.getClientSecret(); // Returns the client secret for the created payment intent
    }
    /**
     * Confirms a payment based on the provided payment intent ID.
     *
     * @param paymentIntentId The unique ID of the payment intent.
     * @return True if the payment is confirmed successfully; otherwise, false.
     * @throws PaymentException If an error occurs while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId); // Calls SDK to confirm the payment using the payment intent ID
    }
}