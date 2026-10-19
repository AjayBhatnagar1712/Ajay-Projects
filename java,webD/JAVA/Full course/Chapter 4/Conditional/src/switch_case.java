import java.util.Scanner;
public class switch_case {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        //For integer
        System.out.println("Enter your Age");
        int age = sc.nextInt();
        switch (age){
            case 18:
                System.out.println("You are going to be an adult");
                break;
            case 23:
                System.out.println("You are going to get a job");
                break;
            case 60:
                System.out.println("You are going to get retired");
                break;
            default:
                System.out.println("Chill buddy");
                break;
            case 11:
                System.out.println("You are an teenager");
                break;

        }
        //for string
        char var = 'r';
        switch (var){
            case 'r':
                System.out.println("You are cool");
                break;
            case 'm':
                System.out.println("hey dude");
                break;
            default:
                System.out.println("sherr");
                break;
        }
    }
}