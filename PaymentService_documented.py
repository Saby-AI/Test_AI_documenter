"""
Date: 10/09/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""
import payment_gateway_sdk
class PaymentService:
    """
    Service for managing payment operations using the payment_gateway_sdk.
    Attributes:
        sdk (SDK): An instance of the payment gateway SDK initialized with a secret key.
    Methods:
        create_payment_intent(amount_in_cents, currency): Creates a new payment intent.
        confirm_payment(payment_intent_id): Confirms a payment intent by ID.
    """
    def __init__(self, secret_key):
        """
        Initializes the PaymentService with a provided secret key.
        Parameters:
            secret_key (str): The secret key for authenticating with the payment gateway SDK.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)
    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a new payment intent with the specified amount and currency.
        Parameters:
            amount_in_cents (int): The amount to charge in cents (e.g., $10.00 = 1000).
            currency (str): The currency in which the payment is made (e.g., 'USD').
        Returns:
            str: The client secret of the created payment intent used for client-side activities.
        Raises:
            Exception: Raises an exception if the payment intent creation fails.
        """
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Return the client secret for client-side use
    def confirm_payment(self, payment_intent_id):
        """
        Confirms a payment intent.
        Parameters:
            payment_intent_id (str): The ID of the payment intent to be confirmed.
        Returns:
            dict: Response from the payment gateway confirming the payment intent.
        Raises:
            Exception: Raises an exception if the confirmation fails.
        """
        return self.sdk.confirm_payment(payment_intent_id)
```
### Summary of Documentation Edits:
- Added comprehensive docstrings for the class and methods to ensure clarity on functionality, parameters, return values, and potential exceptions.
- Preserved original logic and functionality of the code while enhancing the documentation aspects per best practices.