/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService is a service class responsible for handling 
 * payment operations such as creating and confirming payments.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService instance with the specified secret key.
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
     * @param currency The currency in which the amount is specified (e.g., "USD").
     * @return The client secret of the payment intent, which can be used on the client-side.
     * @throws PaymentException if an error occurs while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Call the SDK to create a payment intent with the provided amount and currency
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment based on the provided payment intent ID.
     * 
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return True if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException if an error occurs while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment using the SDK with the given payment intent ID
        return sdk.confirmPayment(paymentIntentId);
    }
}