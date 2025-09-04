"""
Date: 04/09/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""

import payment_gateway_sdk

class PaymentService:
    """
    A service class for managing payment operations, including creating
    and confirming payment intents using a payment gateway SDK.

    Attributes:
        sdk (payment_gateway_sdk.SDK): An instance of the payment gateway SDK
                                        initialized with the provided secret key.
    """

    def __init__(self, secret_key):
        """
        Initializes the PaymentService with the provided secret key.

        Parameters:
            secret_key (str): The secret key used for SDK authentication.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a new payment intent through the payment gateway SDK.

        Parameters:
            amount_in_cents (int): The amount to charge, specified in cents.
            currency (str): The currency code (e.g., 'usd').

        Returns:
            str: The client secret or unique identifier for client-side use.

        Raises:
            ValueError: If amount_in_cents is not a positive integer or
                        if currency is not valid (additional validation to be added).
        """
        # TODO: Validate input parameters
        if amount_in_cents <= 0:
            raise ValueError("amount_in_cents must be a positive integer.")
        if not isinstance(currency, str) or not currency.isalpha():
            raise ValueError("currency must be a valid string.")

        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Or a unique ID for client-side use

    def confirm_payment(self, payment_intent_id):
        """
        Confirms a payment intent using the provided payment_intent_id.

        Parameters:
            payment_intent_id (str): The identifier of the payment intent to confirm.

        Returns:
            dict: Contains details of the payment confirmation.

        Raises:
            ValueError: If the payment_intent_id is invalid (additional validation to be added).
        """
        # TODO: Validate payment_intent_id
        if not isinstance(payment_intent_id, str) or not payment_intent_id:
            raise ValueError("payment_intent_id must be a non-empty string.")

        return self.sdk.confirm_payment(payment_intent_id)