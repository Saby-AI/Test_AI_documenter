// Create a new Party instance for a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Add addresses to the Vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Add contact methods for the Vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Output the Vendor details
        System.out.println(v); // Print the Vendor information
    }
}