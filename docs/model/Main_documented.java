// Creating a new Party instance for a vendor named Tech Supplies Inc.
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding billing and shipping addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Printing information about the vendor
        System.out.println(v);
    }
}