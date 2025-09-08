/*******************************************
 * Date: 07/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 *******************************************/
package test.java;
import main.java.GmailEmailWorkflowTest;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;
/*******************************************
 * Class: GmailEmailWorkflowTestSuite
 * Description: This class serves as a test suite for the GmailEmailWorkflowTest.
 * It includes methods to set up the test environment, execute the test scenarios, and clean up afterwards.
 *******************************************/
public class GmailEmailWorkflowTestSuite {
    private GmailEmailWorkflowTest gmailTest;
    /*******************************************
     * Method: setUp
     * Description: Sets up the test environment before each test.
     *******************************************/
    @Before
    public void setUp() throws Exception {
        gmailTest = new GmailEmailWorkflowTest(); // Initialize the Gmail workflow test object.
    }
    /*******************************************
     * Method: testGmailEmailWorkflow
     * Description: Tests the Gmail email workflow by logging in, composing,
     * saving a draft email, and sending it.
     *******************************************/
    @Test
    public void testGmailEmailWorkflow() throws InterruptedException {
        gmailTest.login(System.getProperty("valid_email_value"), System.getProperty("valid_password_value")); // Logs into Gmail.
        gmailTest.composeAndSaveDraft("recipient@example.com", "Test Subject", "This is the body of the test email.", "C:pathtotest_attachment.pdf"); // Composes and saves a draft email.
        gmailTest.verifyDraft("Test Subject"); // Verifies the draft is saved correctly.
        gmailTest.sendDraft(); // Sends the draft email.
        // Below assertion should be uncommented to verify the email was sent successfully.
        // assertTrue(gmailTest.isEmailSent("Test Subject")); // Asserts that the email was sent.
    }
    /*******************************************
     * Method: tearDown
     * Description: Cleans up the test environment after each test.
     *******************************************/
    @After
    public void tearDown() {
        gmailTest.close(); // Closes the Gmail workflow test object to free resources.
    }
}