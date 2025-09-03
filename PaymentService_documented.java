<!-- Documented Version -->

/********************************************************************************
 * Date: 03/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 ********************************************************************************/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService is responsible for managing payment transactions
 * using the PaymentGatewaySDK. It provides methods to create and 
 * confirm payment intents which are essential for processing payments.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService with the given secret key.
     *
     * @param secretKey A string representing the secret key for 
     *                  initializing the PaymentGatewaySDK.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount of money to be processed, in cents.
     * @param currency      The currency in which the payment is to be made.
     * @return A string representing the client secret or a unique ID 
     *         for client-side use.
     * @throws PaymentException If there is an error during the payment 
     *                          intent creation process.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new payment intent through the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return the client secret for further use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return True if the payment is confirmed successfully; false otherwise.
     * @throws PaymentException If there is an error during the payment 
     *                          confirmation process.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}