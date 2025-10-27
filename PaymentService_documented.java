/*
Date: 27/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
/**
 * PaymentService class handles operations related to payment processing through the Payment Gateway.
 * It provides methods to create and confirm payment intents, ensuring secure and efficient transaction handling.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructor that initializes PaymentGatewaySDK with the provided secret key.
     *
     * @param secretKey the secret key used to initialize the SDK.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent for the specified amount and currency.
     * This method validates the input parameters to ensure they meet the required criteria.
     *
     * @param amountInCents the amount for the payment in cents. Must be a positive value.
     * @param currency the currency for the payment. Must be a valid ISO currency code.
     * @return the client secret of the payment intent, which can be used on the client side.
     * @throws PaymentException if there is an error creating the payment intent.
     * @throws IllegalArgumentException if the amount is non-positive or currency is invalid.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        if (amountInCents <= 0) {
            throw new IllegalArgumentException("Amount must be a positive value.");
        }
        if (currency == null || currency.isEmpty()) {
            throw new IllegalArgumentException("Currency must be a valid ISO currency code.");
        }
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }
    /**
     * Confirms the payment for the given payment intent ID.
     * This method checks the validity of the payment intent ID before processing.
     *
     * @param paymentIntentId the ID of the payment intent to confirm. Must not be null or empty.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException if there is an error confirming the payment.
     * @throws IllegalArgumentException if the payment intent ID is null or empty.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        if (paymentIntentId == null || paymentIntentId.isEmpty()) {
            throw new IllegalArgumentException("Payment intent ID must not be null or empty.");
        }
        return sdk.confirmPayment(paymentIntentId);
    }
}