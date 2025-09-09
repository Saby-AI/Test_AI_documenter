/*
Date: 09/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
/**
 * PaymentService is responsible for creating and confirming payment intents with an external payment gateway SDK.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructor for PaymentService.
     * @param secretKey The secret key to authenticate with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount of the payment in cents.
     * @param currency The currency of the payment (e.g., "USD").
     * @return The client secret for the payment intent, which can be used on the client side.
     * @throws PaymentException If there is an error during the payment intent creation.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }
    /**
     * Confirms a payment with the given payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return True if the payment was confirmed successfully, false otherwise.
     * @throws PaymentException If there is an error during the payment confirmation process.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}