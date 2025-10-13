// String representation of the Address object
    @Override
    public String toString() {
        return "Address{" +
                "id:" + partyAddressId +
                ", type:" + addressType +
                ", line1:" + addressLine1 +
                ", line2:" + addressLine2 +
                ", city:" + city +
                ", state:" + state +
                ", country:" + country +
                ", postal:" + postalCode +
                "}"; // Output format
    }
}