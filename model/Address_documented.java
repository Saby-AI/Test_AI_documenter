/**
     * Returns a string representation of the address for logging/display.
     *
     * @return String representation of the Address object
     */
    public String toString() {
        return "Address{ id: " + partyAddressId + ", type: " + addressType +
               ", line1: " + addressLine1 + ", line2: " + addressLine2 +
               ", city: " + city + ", state: " + state + ", country: " + country +
               ", postal: " + postalCode + " }";
    }
}