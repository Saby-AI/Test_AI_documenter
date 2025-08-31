/******************************************
 * Date: 31/08/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 ******************************************/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService class handles payment operations 
 * using the PaymentGatewaySDK.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService with the specified secret key.
     *
     * @param secretKey the secret key for the payment gateway SDK
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent for a specific amount and currency.
     *
     * @param amountInCents the amount of money to charge in cents
     * @param currency      the currency in which the payment will be made
     * @return the client secret of the created payment intent
     * @throws PaymentException if there is an error during the payment intent creation
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Call to SDK to create a payment intent
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if the payment was successfully confirmed, false otherwise
     * @throws PaymentException if there is an error during the payment confirmation
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment intent through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}