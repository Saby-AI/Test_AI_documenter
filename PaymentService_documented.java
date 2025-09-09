/**
 * Date: 09/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 *
 * PaymentService class handles the payment processing logic for creating and confirming payment intents.
 * It utilizes the PaymentGatewaySDK to interface with the payment service.
 */
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructor initializes the PaymentService with a given secret key.
     *
     * @param secretKey the secret key for the PaymentGatewaySDK initialization
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent through the payment gateway with the specified amount and currency.
     *
     * @param amountInCents the amount to charge, in cents
     * @param currency the currency code (e.g., "USD")
     * @return the client secret of the payment intent
     * @throws PaymentException if error occurs during the creation of the payment intent
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Returns a secret key used on the client side for secure payments
    }
    /**
     * Confirms a payment intent based on its unique identifier.
     *
     * @param paymentIntentId the unique identifier for the payment intent
     * @return true if the payment was successfully confirmed, false otherwise
     * @throws PaymentException if there is an error confirming the payment
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}