package main.java;
import org.openqa.selenium.By; // Importing required classes from Selenium library
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.interactions.Actions;
import java.net.URL; // Handling URL exceptions
import java.util.HashMap;
import java.util.Map; // For key-value pair mapping
public class GmailEmailWorkflowTest {
    private WebDriver driver; // Instance of the WebDriver to control the browser
    /**
     * Constructor for GmailEmailWorkflowTest.
     * It sets up ChromeOptions with specific preferences to disable the password manager
     * and initializes the RemoteWebDriver with the Selenium hub URL.
     *
     * @throws Exception If there is an error during WebDriver initialization.
     */
    public GmailEmailWorkflowTest() throws Exception {
        ChromeOptions options = new ChromeOptions(); // Create ChromeOptions instance
        Map<String, Object> prefs = new HashMap<>(); // Create preferences map
        // Disable password manager features
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_leak_detection", false);
        prefs.put("profile.password_manager_enabled", false);
        options.setExperimentalOption("prefs", prefs); // Set preferences in ChromeOptions
        URL hubUrl = new URL("http://selenium:4444/wd/hub"); // URL for Selenium hub
        driver = new RemoteWebDriver(hubUrl, options); // Initialize RemoteWebDriver
    }
    /**
     * Logs into Gmail with the provided email and password.
     * Waits for the page to load and for the elements to become interactable.
     *
     * @param email    The email address to log in with.
     * @param password The password for the email account.
     * @throws InterruptedException If the thread is interrupted during sleep.
     */
    public void login(String email, String password) throws InterruptedException {
        driver.get("https://mail.google.com"); // Navigate to Gmail
        Thread.sleep(3000); // Wait for page load
        // Send email and navigate to next field
        driver.findElement(By.name("identifier")).sendKeys(email);
        Thread.sleep(3000);
        driver.findElement(By.id("identifierNext")).click(); // Click next
        Thread.sleep(3000);
        // Send password and navigate to next field
        driver.findElement(By.name("password")).sendKeys(password);
        Thread.sleep(3000);
        driver.findElement(By.id("passwordNext")).click(); // Click next
        Thread.sleep(3000);
    }
    /**
     * Composes a new email, attaches a file, and saves it as a draft.
     *
     * @param recipient    The recipient's email address.
     * @param subject      The subject of the email.
     * @param body         The body content of the email.
     * @param attachmentPath The file path to the attachment.
     * @throws InterruptedException If the thread is interrupted during sleep.
     */
    public void composeAndSaveDraft(String recipient, String subject, String body, String attachmentPath) throws InterruptedException {
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Compose')]")); // Click Compose
        Thread.sleep(3000);
        driver.findElement(By.name("to")).sendKeys(recipient); // Enter recipient
        Thread.sleep(3000);
        driver.findElement(By.name("subjectbox")).sendKeys(subject); // Enter subject
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[@aria-label='Message Body']")).sendKeys(body); // Enter body
        Thread.sleep(3000);
        driver.findElement(By.xpath("//input[@type='file']")).sendKeys(attachmentPath); // Attach file
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Close')]")).click(); // Close the compose window
        Thread.sleep(3000);
    }
    /**
     * Verifies the composed draft email by subject.
     * It navigates to the Drafts section and clicks on the draft.
     *
     * @param subject The subject of the draft email to verify.
     * @throws InterruptedException If the thread is interrupted during sleep.
     */
    public void verifyDraft(String subject) throws InterruptedException {
        driver.findElement(By.xpath("//a[contains(text(), 'Drafts')]")).click(); // Open Drafts
        Thread.sleep(3000);
        WebElement draftEmail = driver.findElement(By.xpath("//span[contains(text(), '" + subject + '"])); // Locate draft by subject
        scrollIntoView(draftEmail); // Scroll to the draft
        Thread.sleep(3000);
        draftEmail.click(); // Click on the draft
        Thread.sleep(3000);
    }
    /**
     * Sends the composed draft email.
     *
     * @throws InterruptedException If the thread is interrupted during sleep.
     */
    public void sendDraft() throws InterruptedException {
        driver.findElement(By.xpath("//div[contains(text(), 'Send')]")).click(); // Click Send
        Thread.sleep(3000);
    }
    /**
     * Scrolls the given WebElement into view.
     * This helps in bringing the element into focus before any action is performed on it.
     *
     * @param element The WebElement to scroll into view.
     */
    public void scrollIntoView(WebElement element) {
        Actions actions = new Actions(this.driver); // Create Actions instance
        actions.moveToElement(element); // Move to the specified element
        actions.perform(); // Perform the action
    }
    /**
     * Closes the WebDriver instance and quits the browser.
     * It ensures that the browser is closed after all operations are done.
     */
    public void close() {
        if (driver != null) {
            driver.quit(); // Quit the driver to close all instances
        }
    }
}