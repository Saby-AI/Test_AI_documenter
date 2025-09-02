"""
Date: 02/09/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""

import payment_gateway_sdk

class PaymentService:
    """
    PaymentService class for handling payment transactions using the payment gateway SDK.

    Attributes:
        sdk: An instance of the payment gateway SDK initialized with a secret key.
    """

    def __init__(self, secret_key):
        """
        Initializes the PaymentService with the provided secret key.

        Args:
            secret_key (str): The secret key used to authenticate with the payment gateway SDK.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a payment intent with the specified amount and currency.

        This method interacts with the payment gateway SDK to create a new payment intent and
        returns the client secret for client-side use.

        Args:
            amount_in_cents (int): The amount for the payment in cents.
            currency (str): The currency in which the payment is to be made.

        Returns:
            str: The client secret or unique identifier for the payment intent.
        """
        # Create a payment intent through the SDK
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Or a unique ID for client-side use

    def confirm_payment(self, payment_intent_id):
        """
        Confirms the payment for a given payment intent ID.

        This method calls the payment gateway SDK to confirm the payment associated with 
        the specified payment intent ID.

        Args:
            payment_intent_id (str): The ID of the payment intent to confirm.

        Returns:
            bool: The result of the payment confirmation.
        """
        # Confirm the payment through the SDK
        return self.sdk.confirm_payment(payment_intent_id)