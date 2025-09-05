import model.Address;
import model.Communication;
import model.Party;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Main {

    public static void main(String[] args) {

        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        Logger logger = LoggerFactory.getLogger(Main.class);
        logger.info("Party: {}", c);

        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        logger.info("Party: {}", v);
    }
}
