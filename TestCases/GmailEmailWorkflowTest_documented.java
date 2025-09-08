/**
 * Date: 07/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 */
package main.java;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.interactions.Actions;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
/**
 * GmailEmailWorkflowTest is a class designed to automate Gmail interaction workflows
 * such as logging in, composing drafts, and sending emails.
 */
public class GmailEmailWorkflowTest {
    private WebDriver driver;
    /**
     * Constructor for GmailEmailWorkflowTest that initializes the Chrome WebDriver.
     *
     * @throws Exception if unable to initialize the WebDriver.
     */
    public GmailEmailWorkflowTest() throws Exception {
        ChromeOptions options = new ChromeOptions();
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_leak_detection", false);
        prefs.put("profile.password_manager_enabled", false);
        options.setExperimentalOption("prefs", prefs);
        // Initialize RemoteWebDriver with the Selenium Grid hub URL
        URL hubUrl = new URL("http://selenium:4444/wd/hub");
        driver = new RemoteWebDriver(hubUrl, options);
    }
    /**
     * Logs into Google Mail.
     *
     * @param email the user's email address.
     * @param password the user's password.
     * @throws InterruptedException if the thread is interrupted while sleeping.
     */
    public void login(String email, String password) throws InterruptedException {
        driver.get("https://mail.google.com");
        Thread.sleep(3000);
        // Find email input field and enter the email
        driver.findElement(By.name("identifier")).sendKeys(email);
        Thread.sleep(3000);
        // Click the 'Next' button after entering email
        driver.findElement(By.id("identifierNext")).click();
        Thread.sleep(3000);
        // Find password input field and enter the password
        driver.findElement(By.name("password")).sendKeys(password);
        Thread.sleep(3000);
        // Click the 'Next' button after entering password
        driver.findElement(By.id("passwordNext")).click();
        Thread.sleep(3000);
    }
    /**
     * Composes a new email and saves it as a draft.
     *
     * @param recipient the recipient's email address.
     * @param subject the subject of the email.
     * @param body the body content of the email.
     * @param attachmentPath the path to the attachment file.
     * @throws InterruptedException if the thread is interrupted while sleeping.
     */
    public void composeAndSaveDraft(String recipient, String subject, String body, String attachmentPath) throws InterruptedException {
        Thread.sleep(3000);
        // Click the 'Compose' button
        driver.findElement(By.xpath("//div[contains(text(), 'Compose')]")).click();
        Thread.sleep(3000);
        // Enter recipient's address
        driver.findElement(By.name("to")).sendKeys(recipient);
        Thread.sleep(3000);
        // Enter the subject of the email
        driver.findElement(By.name("subjectbox")).sendKeys(subject);
        Thread.sleep(3000);
        // Enter the body of the email
        driver.findElement(By.xpath("//div[@aria-label='Message Body']")).sendKeys(body);
        Thread.sleep(3000);
        // Upload an attachment
        driver.findElement(By.xpath("//input[@type='file']")).sendKeys(attachmentPath);
        Thread.sleep(3000);
        // Close the draft
        driver.findElement(By.xpath("//div[contains(text(), 'Close')]")).click();
        Thread.sleep(3000);
    }
    /**
     * Verifies the draft email by searching for it in the Drafts folder.
     *
     * @param subject the subject of the draft email to verify.
     * @throws InterruptedException if the thread is interrupted while sleeping.
     */
    public void verifyDraft(String subject) throws InterruptedException {
        // Click the 'Drafts' folder
        driver.findElement(By.xpath("//a[contains(text(), 'Drafts')]")).click();
        Thread.sleep(3000);
        // Find the draft email element
        WebElement draftEmail = driver.findElement(By.xpath("//span[contains(text(), '" + subject + "')]"));
        scrollIntoView(draftEmail);
        Thread.sleep(3000);
        // Click to open the draft email
        draftEmail.click();
        Thread.sleep(3000);
    }
    /**
     * Sends the drafted email.
     *
     * @throws InterruptedException if the thread is interrupted while sleeping.
     */
    public void sendDraft() throws InterruptedException {
        // Click the 'Send' button
        driver.findElement(By.xpath("//div[contains(text(), 'Send')]")).click();
        Thread.sleep(3000);
    }
    /**
     * Scrolls the specified element into view.
     *
     * @param element the WebElement to scroll into view.
     */
    public void scrollIntoView(WebElement element) {
        // Create actions to perform scrolling
        Actions actions = new Actions(this.driver);
        actions.moveToElement(element);
        actions.perform();
    }
    /**
     * Closes the WebDriver session.
     */
    public void close() {
        if (driver != null) {
            driver.quit();
        }
    }
}