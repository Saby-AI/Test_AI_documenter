package test.java;

import main.java.GmailEmailWorkflowTest;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

public class GmailEmailWorkflowTestSuite {
    private GmailEmailWorkflowTest gmailTest;

    @Before
    public void setUp() throws Exception {
        gmailTest = new GmailEmailWorkflowTest();
    }

    @Test
    public void testGmailEmailWorkflow() throws InterruptedException {
        gmailTest.login(System.getProperty("valid_email_value"), System.getProperty("valid_password_value"));
        gmailTest.composeAndSaveDraft("recipient@example.com", "Test Subject", "This is the body of the test email.", "C:\path\to\test_attachment.pdf");
        gmailTest.verifyDraft("Test Subject");
        gmailTest.sendDraft();
        // Add assertions to verify email sent
        // Example: assertTrue(gmailTest.isEmailSent("Test Subject"));
    }

    @After
    public void tearDown() {
        gmailTest.close();
    }
}