// Example: go run ./examples (with HEXVault API on :3850)
package main

import (
	"fmt"
	"log"

	"github.com/sawon2026/HEXVault/packages/sdk-go/hexvault"
)

func main() {
	c := hexvault.New("http://127.0.0.1:3850")
	h, err := c.Health()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("health:", h)

	_, err = c.AddMemory("Go SDK example memory", "go-sdk", "note", []string{"go", "sdk"})
	if err != nil {
		log.Fatal(err)
	}
	s, err := c.Search("SDK", 5)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("search:", s)
}
