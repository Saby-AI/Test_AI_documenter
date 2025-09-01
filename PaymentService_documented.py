"""
Date: 01/09/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""

import payment_gateway_sdk

class PaymentService:
    """
    This class handles payment processing using the payment gateway SDK.

    Attributes:
        sdk (SDK): An instance of the payment gateway SDK initialized with the secret key.
    """

    def __init__(self, secret_key):
        """
        Initializes the PaymentService with the provided secret key.

        Args:
            secret_key (str): The secret key used to authenticate with the payment gateway.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a payment intent for the specified amount and currency.

        Args:
            amount_in_cents (int): The amount to be charged in cents.
            currency (str): The currency in which the payment will be processed (e.g., 'usd').

        Returns:
            str: The client secret for the payment intent, which is used for client-side payment processing.
        """
        # Create the payment intent using the SDK
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Return the client secret for further use

    def confirm_payment(self, payment_intent_id):
        """
        Confirms the payment for a given payment intent ID.

        Args:
            payment_intent_id (str): The ID of the payment intent to confirm.

        Returns:
            dict: The response from the payment gateway after confirming the payment.
        """
        # Confirm the payment using the provided payment intent ID
        return self.sdk.confirm_payment(payment_intent_id)